const _ = require('lodash')
const {
  User,
  CohortManager,
  Role,
  UserInformationEuWest,
  UserInformation,
  CohortStudent,
  Cohort,
  sequelize,
} = require('../../db/models')
const logger = require('../../util/logger')
const { getUploadUrlForRegoin, S3_BUCKET } = require('./aws')
const { USER_AREA } = require('../../util/constants')
const { MemoryCache } = require('./middlewareCache')
const { retryOnSerializationError } = require('../../util/retrySerializable')

/** Cache userId → cohortArea with a 10-min TTL (area never changes mid-session). */
const _cohortAreaCache = new MemoryCache('cohortArea', 10 * 60 * 1000)

// You must ensure that the user object is database model object, not a plain object
function getUserInfomationFromUserModel(user) {
  return user.userInfo || user.userInfoEuWest
}

/**
 * Atomic IP history update — uses a single UPDATE statement so concurrent
 * requests from different dynos never conflict (no read-modify-write race).
 */
async function updateIpHistoryAtomic(user, ip) {
  const info = getUserInfomationFromUserModel(user)
  if (!info || (process.env.ENV && process.env.ENV == 'development')) return

  // Skip write if the IP hasn't changed — avoids FDW serialization storms
  // when the same EU user fires many concurrent requests.
  if (info.lastIP === ip) return

  const isEuWest = !user.userInfo && !!user.userInfoEuWest
  const table = isEuWest ? '"eu_west_server_public"."UserInformations"' : '"UserInformations"'

  // Single atomic UPDATE:
  // 1. Remove any existing entry for this IP from the jsonb array
  // 2. Prepend the new entry
  // 3. Trim to 10 entries
  // 4. Also set lastIP
  // Wrapped in retry for FDW serialization conflicts (REPEATABLE READ on remote).
  await retryOnSerializationError(
    () =>
      sequelize.query(
        `UPDATE ${table}
        SET "lastIPs" = (
              SELECT jsonb_agg(elem)
              FROM (
                SELECT elem
                FROM jsonb_array_elements(
                       jsonb_build_array($1::jsonb) ||
                       COALESCE(
                         (SELECT jsonb_agg(e) FROM jsonb_array_elements("lastIPs") AS e WHERE e->>'ip' <> $2),
                         '[]'::jsonb
                       )
                     ) WITH ORDINALITY AS t(elem, ord)
                ORDER BY ord
                LIMIT 10
              ) sub
            ),
            "lastIP" = $2,
            "updatedAt" = NOW()
      WHERE id = $3`,
        {
          bind: [JSON.stringify({ ip, lastAccess: new Date().toISOString() }), ip, info.id],
          type: sequelize.QueryTypes.UPDATE,
        }
      ),
    { label: `IP history update (user ${user.id})` }
  )
}

function errorHandler(res, ex, message) {
  if (res.headersSent) return
  let error_description = ''

  if (message) {
    logger.error(message)
  }

  if (ex.error_description) {
    error_description = ex.error_description
  } else {
    console.log('Unhandled API error occurred:')
    console.log(ex)

    error_description = 'Unknown Error'
  }

  return res.json({
    success: false,
    error_description,
  })
}

function isAdmin(user) {
  const additionalEmails = process.env.ADMIN_EMAIL_ADDITIONAL
  const userInfo = getUserInfomationFromUserModel(user) || {}
  const email = userInfo.email || ''

  return !!userInfo.isAdmin || (!!additionalEmails && _.includes(_.split(additionalEmails, ','), email))
}

// expects a user object with roles, e.g.:
// { id: 123, roles: [{ name: 'translator' }]}
function isTranslator(user) {
  let roleNames = user.roles.map((role) => role.name)
  return roleNames.includes('translator')
}

async function isManagerOrAdmin(user) {
  return await isManagerOfCohort(user, null, true)
}

async function isManager(user) {
  return await isManagerOfCohort(user, null, false)
}

async function isManagerOfCohortOrAdmin(user, cohortId) {
  return await isManagerOfCohort(user, cohortId, true)
}

async function getMineCohortArea(userId) {
  const cached = _cohortAreaCache.get(userId)
  if (cached !== undefined) return cached

  // otherwise, return the area of the first cohort student record
  const cohortStudent = await CohortStudent.findOne({
    where: { userId },
    include: [{ model: Cohort, as: 'cohort', attributes: ['area'] }],
  })
  const area = cohortStudent ? cohortStudent.cohort.area : USER_AREA.US_EAST
  _cohortAreaCache.set(userId, area)
  return area
}

async function getCohortArea(cohortId) {
  // Fetch the cohort area based on the cohort ID
  const cohort = await Cohort.findOne({
    where: { id: cohortId },
    attributes: ['area'],
  })
  if (cohort) {
    return cohort.area
  } else {
    return USER_AREA.US_EAST // default to US East if no cohort found
  }
}

// shouldCheckIfUserIsAnAdmin - if passed, will also return true if user is admin
async function isManagerOfCohort(user, cohortId, shouldCheckIfUserIsAnAdmin) {
  const userInfo = getUserInfomationFromUserModel(user)
  if (shouldCheckIfUserIsAnAdmin && isAdmin(user)) {
    return true
  }

  // Handle API key authentication - API keys are scoped to specific cohorts
  if (userInfo.isApiKey) {
    // If no specific cohort is requested, API key is a valid manager
    if (!cohortId) {
      return true
    }
    // If specific cohort is requested, check if it matches the API key's cohort
    return userInfo.cohortId === parseInt(cohortId)
  }

  const query = { userId: user.id }

  // add the cohort ID to the query if it is passed in to the function
  if (cohortId) {
    query.cohortId = cohortId
  }

  const numOfManagerRecords = await CohortManager.count({ where: query })
  return numOfManagerRecords > 0
}

async function fetchLoggedInUser(req, res, next) {
  // Handle API key authentication
  if (req.session.apiKey) {
    // For API key requests, create a virtual user object with cohort manager privileges
    const virtualUser = {
      id: null, // API key doesn't have a user ID
      isAdmin: false,
      cohortId: req.session.apiKey.cohortId,
      cohort: req.session.apiKey.cohort,
      roles: [{ name: 'cohort_manager' }], // API keys have cohort manager privileges
      isApiKey: true,
      userInfo: {
        isAdmin: false,
      },
    }

    // TODO: Dev need to check, the session.user must be an user model object, not a plain object
    _.set(req, 'session.user', virtualUser)
    req.user = virtualUser
    return next()
  }

  // Handle JWT authentication
  if (!req.session.userId) {
    return res.status(401).send('Not logged in!')
  }

  // If the auth middleware already loaded the full user, reuse it to avoid
  // a redundant DB round-trip (~20-80ms saved per request).
  if (req.session.user && req.user) {
    const forwardedIp = req.headers['x-forwarded-for']
    const ip = forwardedIp ? forwardedIp.split(',')[0].trim() : req.socket.remoteAddress

    // Fire-and-forget atomic IP history update
    setImmediate(async () => {
      try {
        await updateIpHistoryAtomic(req.session.user, ip)
      } catch (e) {
        logger.warn('Failed to update user IP history', e.message)
      }
    })
    return next()
  }

  // Fallback: query the database if user wasn't pre-loaded (e.g., non-standard auth flow)
  {
    let user = await User.findOne({
      where: { id: req.session.userId },
      include: [
        {
          model: Role,
          as: 'roles',
          attributes: ['name'],
        },
        {
          model: UserInformationEuWest,
          as: 'userInfoEuWest',
        },
        {
          model: UserInformation,
          as: 'userInfo',
        },
        {
          model: CohortManager,
          as: 'cohortManagers',
          include: [
            {
              model: Cohort,
              as: 'cohort',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    })
    if (!user) {
      return res.status(401).send('User not found')
    } else {
      const forwardedIp = req.headers['x-forwarded-for']
      const ip = forwardedIp ? forwardedIp.split(',')[0].trim() : req.socket.remoteAddress

      // support req.session.user.isAdmin being used directly
      const userInformation = getUserInfomationFromUserModel(user)
      if (userInformation) userInformation.isAdmin = isAdmin(user)
      user.isAdmin = isAdmin(user)
      // Add cohort information for cohort managers
      if (user.cohortManagers && user.cohortManagers.length > 0) {
        user.managedCohorts = user.cohortManagers.map((cm) => cm.cohort)
        // For single cohort managers, set cohortId for backwards compatibility
        if (user.cohortManagers.length === 1) {
          user.cohortId = user.cohortManagers[0].cohortId
        }
      }
      _.set(req, 'session.user', user)
      req.user = user // Apparently Sentry.io needs this to be there for err reporting, so we might as well give up on req.session.user in the long-run...
      next()

      // Fire-and-forget atomic IP history update
      setImmediate(async () => {
        try {
          await updateIpHistoryAtomic(user, ip)
        } catch (e) {
          logger.warn('Failed to update user IP history', e.message)
        }
      })
    }
  }
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    throw Error('You must use fetchLoggedInUser first')
  } else {
    if (isAdmin(req.session.user)) {
      next()
    } else {
      res.status(401).json({ success: false, error: 'You must be an authorized admin to access this resource' })
    }
  }
}

async function requireAdminOrCohortManager(req, res, next) {
  try {
    const user = req.session.user
    if (!user) {
      throw Error('You must use fetchLoggedInUser first')
    }
    if (await isManagerOrAdmin(user)) {
      return next()
    }
    return res
      .status(403)
      .json({ success: false, error: 'You must be an admin or cohort manager to access this resource' })
  } catch (err) {
    return next(err)
  }
}

function requireAdminOrTranslator(req, res, next) {
  let user = req.session.user
  if (!user) {
    throw Error('You must use fetchLoggedInUser first')
  } else {
    if (isAdmin(user) || isTranslator(user)) {
      next()
    } else {
      res
        .status(401)
        .json({ success: false, error: 'You must be an authorized admin or translator to access this resource' })
    }
  }
}

function serializeUser(user) {
  const userInfo = getUserInfomationFromUserModel(user)

  return {
    ..._.pick(user, [
      'id',
      // 'region',
      // 'legalName',
      // 'nickName',
      // 'email',
      'cohortStudents',
      'cohortManagers',
      // 'fieldStrengthPreference',
      // 'defaultLanguageCode',
      // 'vendorStylePreference',
      // 'softwareVendorPreference',
      // 'softwareVersionPreference',
      // 'language',
      'registrationCode',
      // 'injectionMode',
      // 'injectCondition',
      // 'sliceExpansionBehavior',
      // 'defaultContrastOnlyProtocol',
      // 'defaultContrastAndSalineProtocol',
    ]),
    ..._.pick(userInfo, [
      'legalName',
      'nickName',
      'email',
      'lastIP',
      'lastIPs',
      'fieldStrengthPreference',
      'defaultLanguageCode',
      'vendorStylePreference',
      'softwareVendorPreference',
      'softwareVersionPreference',
      'sliceFrameRate',
      'scientificMode',
      'language',
      'injectionMode',
      'injectCondition',
      'sliceExpansionBehavior',
      'defaultContrastOnlyProtocol',
      'defaultContrastAndSalineProtocol',
      'settings',
    ]),
  }
}

// SliceViews are the answers images data for a stackquestion as part of a testresult; we store the images in s3, so when serializing fill in the img src with a signed http url that the browser can fetch
async function serializeSliceViews(sliceViews) {
  return Promise.all(
    _.map(sliceViews, async function (sliceView) {
      if (sliceView.pathKey) {
        return Object.assign({}, sliceView, {
          src: await getUploadUrlForRegoin(sliceView.pathKey, sliceView.bucket || S3_BUCKET),
        })
      }
      return sliceView
    })
  )
}

function isContrastLab(name) {
  return name.includes('(Contrast Lab)')
}

function isResolutionLab(name) {
  return name.includes('(Resolution Lab)')
}

module.exports = {
  isAdmin,
  isManager,
  isManagerOrAdmin,
  isManagerOfCohort,
  getMineCohortArea,
  isManagerOfCohortOrAdmin,
  isTranslator,
  fetchLoggedInUser,
  requireAdmin,
  requireAdminOrCohortManager,
  requireAdminOrTranslator,
  errorHandler,
  serializeUser,
  serializeSliceViews,
  isContrastLab,
  isResolutionLab,
  getUserInfomationFromUserModel,
  getCohortArea,
}
