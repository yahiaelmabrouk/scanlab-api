const _ = require('lodash')
const logger = require('../util/logger')
const moment = require('moment/moment')
const express = require('express')
const router = express.Router()
const login = require('./login')
const user = require('./user')
const userPreferences = require('./userPreferences')
const dicom = require('./dicom')
const questionSetResults = require('./questionSetResults')
const bodyParts = require('./bodyParts')
const regions = require('./regions')
const userReportData = require('./userReportData')
const categories = require('./categories')
const { router: statistics } = require('./statistics')
const cohorts = require('./cohorts')
const cohortManagers = require('./cohortManagers')
const cohortStudents = require('./cohortStudents')
const registrationCodes = require('./registrationCodes')
const translatedContent = require('./translatedContent')
const preparedExam = require('./preparedExam')
const cohortPreparedExam = require('./cohortPreparedExam')
const roles = require('./roles')
const analysis = require('./analysis')
const { jwtDecode } = require('../util/jwt')
const { fetchLoggedInUser, getUserInfomationFromUserModel, isAdmin } = require('./api_util/api_util')
const { validateApiKeyMiddleware } = require('./api_util/apiKeyMiddleware')
const { trackApiKeyUsage } = require('./api_util/usageTracking')
const { checkRateLimit } = require('./api_util/rateLimiter')
const { validateEndpointPermissions } = require('./api_util/endpointPermissions')
const { userSessionCache } = require('./api_util/middlewareCache')
const { User, sequelize, UserInformationEuWest, UserInformation, Role, CohortManager, Cohort } = require('../db/models')

// You can login without already being logged in
router.use(login)
router.use(require('./controllers/globalLanguage.controller'))

function checkExpired(oldDate, newDate) {
  const oldDateUnix = moment(oldDate).unix()
  const newDateUnix = moment(newDate).unix()
  return newDateUnix > oldDateUnix
}

//
// Force Login below this line - Support both JWT and API Key authentication
//
router.use(async function (req, res, next) {
  // Check for API Key authentication first
  if (_.isString(req.headers['x-api-key'])) {
    return validateApiKeyMiddleware(req, res, next)
  }

  // Fall back to JWT authentication
  // Primary: Authorization header
  // Fallback: Query parameter (for sendBeacon which cannot set custom headers)
  let token = null
  if (_.isString(req.headers.authorization) && req.headers.authorization.substring(0, 7) === 'Bearer ') {
    token = req.headers.authorization.substring(7)
  } else if (_.isString(req.query.access_token)) {
    token = req.query.access_token
  }

  if (token) {
    try {
      let decoded = jwtDecode(token)
      // Expired removed multiply by 1000 because we are getting actual date
      let expiresAt = moment(decoded['generated_at']).add(14, 'days').unix()

      // ── User-session cache ──────────────────────────────────────────────
      // Key combines userId + JWT generated_at so each distinct token gets
      // its own entry and a logout (which bumps minJWTGeneratedAt) that hits
      // the DB will evict all prior entries via deletePrefix() in /logout.
      const cacheKey = `${decoded.user.id}:${decoded['generated_at']}`
      const cachedUser = userSessionCache.get(cacheKey)

      if (cachedUser) {
        logger.info('User session cache hit: ' + decoded.user.id)
        _.set(req, 'session.userId', decoded.user.id)
        _.set(req, 'session.user', cachedUser)
        req.user = cachedUser
        req._userSessionCacheKey = cacheKey
        return next()
      }
      // ───────────────────────────────────────────────────────────────────

      // Single comprehensive query: validates JWT and pre-loads the full user
      // so that downstream fetchLoggedInUser can skip a redundant DB round-trip.
      const user = await User.findOne({
        where: { id: decoded.user.id },
        attributes: {
          include: [
            [
              sequelize.fn(
                'COALESCE',
                sequelize.col('userInfo.minJWTGeneratedAt'),
                sequelize.col('userInfoEuWest.minJWTGeneratedAt')
              ),
              'minJWTGeneratedAt',
            ],
          ],
        },
        include: [
          {
            model: UserInformationEuWest,
            as: 'userInfoEuWest',
          },
          {
            model: UserInformation,
            as: 'userInfo',
          },
          {
            model: Role,
            as: 'roles',
            attributes: ['name'],
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
        logger.info('User not found in database')
        return res.status(401).send('Token invalid')
      }

      // Compare saved date with jwt generated date
      const loggedOutElsewhere = checkExpired(decoded['generated_at'], user.minJWTGeneratedAt)
      if (loggedOutElsewhere || moment().unix() > expiresAt) {
        logger.info('Login expired')
        return res.status(401).send('Login expired')
      } else {
        logger.info('User is logged in: ' + decoded.user.id)

        // Enrich user with computed properties (same logic as fetchLoggedInUser)
        const userInformation = getUserInfomationFromUserModel(user)
        if (userInformation) userInformation.isAdmin = isAdmin(user)
        user.isAdmin = isAdmin(user)

        // Add cohort information for cohort managers
        if (user.cohortManagers && user.cohortManagers.length > 0) {
          user.managedCohorts = user.cohortManagers.map((cm) => cm.cohort)
          if (user.cohortManagers.length === 1) {
            user.cohortId = user.cohortManagers[0].cohortId
          }
        }

        // Cache the fully-enriched user so subsequent requests within the TTL
        // window skip this DB round-trip entirely.
        userSessionCache.set(cacheKey, user)

        _.set(req, 'session.userId', decoded.user.id)
        _.set(req, 'session.user', user)
        req.user = user
        req._userSessionCacheKey = cacheKey
        return next()
      }
    } catch (e) {
      logger.info('Login token invalid')
      return res.status(401).send('Token invalid')
    }
  } else {
    return res.status(401).send('Not logged in')
  }
})

// Add rate limiting, usage tracking, and endpoint permission validation for all authenticated requests
router.use(checkRateLimit)
router.use(validateEndpointPermissions)
router.use(trackApiKeyUsage)

router.use(user)
router.use(userPreferences)

router.use(dicom)

router.use(require('./controllers/questionSets.controller'))
router.use(questionSetResults)

router.use(userReportData)

router.use(regions)
router.use(bodyParts)
router.use(categories)
router.use(statistics)

router.use(cohorts)
router.use(cohortManagers)
router.use(cohortStudents)
router.use(registrationCodes)
router.use(require('./controllers/apiKey.controller'))
router.use(require('./controllers/endpoints.controller'))
router.use(require('./controllers/cohortEndpointPermissions.controller'))
router.use(translatedContent)
router.use(preparedExam)
router.use(cohortPreparedExam)
router.use(roles)
router.use(analysis)
router.use(require('./controllers/patientPositions.controller'))
router.use(require('./controllers/bodyBox.controller'))
router.use(require('./controllers/injectionAttributes.controller'))
router.use(require('./controllers/contrastRangePreset.controller'))

router.use(require('./controllers/criticalThinkingQuestion.controller'))
router.use(require('./controllers/questionGroup.controller'))
router.use(require('./controllers/testRun.controller'))
router.use(require('./controllers/model.controller'))
router.use(require('./controllers/patientPositionSet.controller'))
router.use(require('./controllers/patientPhysio.controller'))
router.use(require('./controllers/stackQuestionResult.controller'))
router.use(require('./controllers/language.controller'))
router.use(require('./controllers/resource.controller'))
router.use(require('./controllers/resourceCategory.controller'))
router.use(require('./controllers/stackQuestionResultComment.controller'))
router.use(require('./controllers/weightBasedDose.controller'))
router.use(require('./controllers/digitalLocalizer.controller'))
router.use(require('./controllers/questionProbe.controller'))
router.use(require('./controllers/interventionRules.controller'))
router.use(require('./controllers/notification.controller'))

router.post('/logout', fetchLoggedInUser, async function (req, res) {
  const user = req.user
  const userInformation = getUserInfomationFromUserModel(user)
  if (userInformation) {
    userInformation.minJWTGeneratedAt = moment().toDate()
    await userInformation.save()
  }

  // Evict ALL cached sessions for this user so any subsequent request with
  // an old token is forced back to the DB (where it will see the bumped
  // minJWTGeneratedAt and be rejected as expired).
  userSessionCache.deletePrefix(`${user.id}:`)

  return res.json({ success: true })
})

router.get('/hello', function (req, res) {
  res.json({ hello: true })
})

module.exports = router
