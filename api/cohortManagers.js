const express = require('express')
const { fetchLoggedInUser, requireAdmin, errorHandler } = require('./api_util/api_util')
const { CohortManager, User, UserInformationEuWest, UserInformation, sequelize } = require('../db/models')

const router = express.Router()

router.get('/cohortManagers', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let where = {}

    if (req.query.cohortId) {
      where.cohortId = req.query.cohortId
    }

    let cohortManagers = await CohortManager.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: [
            'id',
            [
              sequelize.literal(`
                COALESCE(
                  "user->userInfo"."legalName",
                  "user->userInfoEuWest"."legalName",
                  'N/A'
                )
              `),
              'legalName',
            ],
            [
              sequelize.literal(`
                COALESCE(
                  "user->userInfo"."email",
                  "user->userInfoEuWest"."email",
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
      ],
    })

    res.json({ success: true, cohortManagers })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.post('/cohortManagers', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let cohortManager = await CohortManager.create(req.body)

    res.json({ success: true, cohortManager })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.delete('/cohortManagers/:id', fetchLoggedInUser, requireAdmin, async function (req, res) {
  let id = req.params.id

  await CohortManager.destroy({
    where: { id },
  })

  res.json({ success: true })
})

module.exports = router
