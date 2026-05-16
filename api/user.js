const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const _ = require('lodash')
const {
  User,
  UserInformationEuWest,
  UserInformation,
  CohortStudent,
  CohortManager,
  RegistrationCode,
  Cohort,
  sequelize,
} = require('../db/models')
const service = require('./services/user.service')
const { errorHandler, fetchLoggedInUser, requireAdmin, serializeUser } = require('./api_util/api_util')
const { SALTROUNDS } = require('./api_util/authentication')
const { getSequelizePagination, formatPaginatedResponse } = require('./api_util/pagination')
const ModelProvider = require('./providers/model.provider')

function formatUserUpdate(params) {
  let payload = _.pick(params, ['legalName', 'nickName', 'language'])

  if (params.email) {
    payload.email = params.email.toLowerCase()
  }

  return payload
}

router.get('/users', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let where = {}

    if (req.query.email) {
      let email = req.query.email.toLowerCase()
      where.email = email
    }

    if (req.query.search) {
      const rawTerm = req.query.search.replace(/[%_]/g, '\\$&')
      const escaped = sequelize.escape(`%${rawTerm}%`)
      const escapedPrefix = sequelize.escape(`${rawTerm}%`)

      where[sequelize.Sequelize.Op.and] = [
        sequelize.literal(`(
          CAST("User"."id" AS TEXT) LIKE ${escapedPrefix}
          OR COALESCE("userInfo"."legalName", "userInfoEuWest"."legalName", '') ILIKE ${escaped}
          OR COALESCE("userInfo"."email", "userInfoEuWest"."email", '') ILIKE ${escaped}
          OR EXISTS (
            SELECT 1 FROM "CohortStudents" cs
            JOIN "Cohorts" c ON c.id = cs."cohortId"
            WHERE cs."userId" = "User"."id"
            AND c."name" ILIKE ${escaped}
          )
        )`),
      ]
    }

    const pagination = getSequelizePagination(req.query)

    // Build ORDER BY clause from query params
    const SORTABLE_COLUMNS = {
      userId: sequelize.literal('"User"."id"'),
      name: sequelize.literal(`COALESCE("userInfo"."legalName", "userInfoEuWest"."legalName", '')`),
      email: sequelize.literal(`COALESCE("userInfo"."email", "userInfoEuWest"."email", '')`),
    }
    const sortKey = req.query.sortBy && SORTABLE_COLUMNS[req.query.sortBy] ? req.query.sortBy : 'userId'
    const sortDir = req.query.sortDesc === 'true' ? 'DESC' : 'ASC'
    const orderClause = [[SORTABLE_COLUMNS[sortKey], sortDir]]

    // Step 1: Get paginated user IDs using only 1:1 joins so LIMIT is accurate
    const { rows: idRows, count: total } = await User.findAndCountAll({
      ...pagination,
      where,
      subQuery: false,
      attributes: ['id'],
      include: [
        { model: UserInformation, as: 'userInfo', attributes: [] },
        { model: UserInformationEuWest, as: 'userInfoEuWest', attributes: [] },
      ],
      order: orderClause,
    })
    const totalCount = Array.isArray(total) ? total.length : total
    const userIds = idRows.map((r) => r.id)

    // Step 2: Fetch full data (with all associations) for those IDs
    let users = []
    if (userIds.length > 0) {
      users = await User.findAll({
        where: { id: userIds },
        order: orderClause,
        include: [
          {
            model: CohortStudent,
            as: 'cohortStudents',
            attributes: ['registrationCodeId', 'userId'],
            include: [
              {
                model: RegistrationCode,
                as: 'registrationCode',
                attributes: ['id', 'code', 'status', 'activationDate', 'numOfDaysActive'],
              },
              {
                model: Cohort,
                as: 'cohort',
                attributes: ['id', 'name'],
              },
            ],
          },
          {
            model: CohortManager,
            as: 'cohortManagers',
            attributes: ['cohortId', 'userId'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: [
                  'id',
                  [
                    sequelize.literal(`
                      COALESCE(
                        "cohortManagers->user->userInfo"."legalName",
                        "cohortManagers->user->userInfoEuWest"."legalName",
                        'N/A'
                      )
                    `),
                    'legalName',
                  ],
                  [
                    sequelize.literal(`
                      COALESCE(
                        "cohortManagers->user->userInfo"."email",
                        "cohortManagers->user->userInfoEuWest"."email",
                        'N/A'
                      )
                    `),
                    'email',
                  ],
                ],
                include: [
                  {
                    model: UserInformationEuWest,
                    as: 'userInfoEuWest',
                  },
                  {
                    model: UserInformation,
                    as: 'userInfo',
                  },
                ],
              },
              {
                model: Cohort,
                as: 'cohort',
                attributes: ['id', 'name'],
              },
            ],
          },
          {
            model: UserInformationEuWest,
            as: 'userInfoEuWest',
          },
          {
            model: UserInformation,
            as: 'userInfo',
          },
        ],
      })
    }
    let serializedUsers = users.map((user) => {
      return Object.assign(serializeUser(user), _.pick(user, 'lastIP'), {
        registrationCode: _.get(user, 'cohortStudents[0].registrationCode'),
      })
    })

    const paginationMeta = formatPaginatedResponse(serializedUsers, pagination, totalCount).pagination
    res.json({ success: true, users: serializedUsers, pagination: paginationMeta })
  } catch (e) {
    errorHandler(res, e)
  }
})

router.get('/users/:id', async function (req, res) {
  await service.findUserById(req.session.userId, res)
})

router.post('/users/:id', async function (req, res) {
  try {
    let payload = formatUserUpdate(req.body)
    const [[numberOfAffectedRows]] = await Promise.all([
      User.update(payload, {
        where: { id: req.session.userId },
      }),
      UserInformationEuWest.update(payload, {
        where: { userId: req.session.userId },
      }),
      UserInformation.update(payload, {
        where: { userId: req.session.userId },
      }),
    ])

    if (numberOfAffectedRows < 1) {
      errorHandler(res, { error_description: 'User not found' })
    } else {
      res.json({ success: true })
    }
  } catch (e) {
    errorHandler(res, e, 'Unable to update user')
  }
})
router.delete('/users/:id', fetchLoggedInUser, requireAdmin, async function (req, res) {
  const userId = req.params.id
  try {
    const modelProvider = await ModelProvider.getModelProvider(userId)
    await sequelize.transaction(async (t) => {
      // These four are independent — destroy them in parallel
      await Promise.all([
        CohortStudent.destroy({ where: { userId }, transaction: t }),
        CohortManager.destroy({ where: { userId }, transaction: t }),
        modelProvider.MultipleChoiceQuestionResult.destroy({ where: { userId }, transaction: t }),
        modelProvider.QuestionSetResult.destroy({ where: { userId }, transaction: t }),
      ])

      // TestRun must follow MCQ/QSR destroys (FK dependency)
      await modelProvider.TestRun.destroy({ where: { userId }, transaction: t })

      await modelProvider.UserInformation.destroy({ where: { userId }, transaction: t })

      // If they used a code, remove reference to who it was for, but it keeps the used:true
      const code = await RegistrationCode.findOne({ where: { userId }, transaction: t })
      if (code) {
        await code.update({ userId: null }, { transaction: t })
      }

      await User.destroy({ where: { id: userId }, transaction: t })
    })
    res.json({ success: true })
  } catch (e) {
    errorHandler(res, e, 'Unable to delete user')
  }
})

router.post('/users/:id/password', async function (req, res) {
  try {
    const modelProvider = await ModelProvider.getModelProvider(req.session.userId)
    const userInformation = await modelProvider.UserInformation.findOne({
      where: { userId: req.session.userId },
    })

    if (await bcrypt.compare(req.body.currentPassword, userInformation.passHash)) {
      // validate that both passwords are different
      if (req.body.newPassword !== req.body.currentPassword) {
        const hash = await bcrypt.hash(req.body.newPassword, SALTROUNDS)
        await userInformation.update(
          {
            passHash: hash,
          },
          {
            where: { userId: req.session.userId },
          }
        )

        res.json({ success: true })
      } else {
        errorHandler(res, { error_description: 'Given passwords are the same' })
      }
    } else {
      errorHandler(res, { error_description: 'Cannot validate password' })
    }
  } catch (e) {
    errorHandler(res, e)
  }
})

module.exports = router
