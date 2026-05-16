const express = require('express')
const moment = require('moment/moment')
const { fetchLoggedInUser, requireAdmin, isManagerOfCohortOrAdmin, errorHandler, getUserInfomationFromUserModel } = require('./api_util/api_util')
const { getRegistrationCodeExpirationDate } = require('./api_util/registrationCode')
const { updateCounts } = require('./api_util/cohorts')
const { Cohort, RegistrationCode, User, UserInformation, UserInformationEuWest, sequelize } = require('../db/models')
const { userSessionCache } = require('./api_util/middlewareCache')

const router = express.Router()

function hex(n) {
  n = n || 16
  var result = ''
  while (n--) {
    result += Math.floor(Math.random() * 16)
      .toString(16)
      .toLowerCase()
  }
  return result
}

router.get('/registrationCodes', fetchLoggedInUser, async function (req, res) {
  let cohortId = req.query.cohortId
  if (!(await isManagerOfCohortOrAdmin(req.session.user, cohortId))) {
    res.status(403).send('')
    return
  }

  try {
    let where = {}

    if (req.query.cohortId) {
      where.cohortId = cohortId
    }

    if (req.query.unused === 'true') {
      where.used = false
    }

    let registrationCodes = await RegistrationCode.findAll({
      order: [['id', 'ASC']],
      attributes: ['id', 'code', 'notes', 'status', 'expirationDate', 'activationDate', 'numOfDaysActive'],
      where,
    })

    res.json({ success: true, registrationCodes })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.post('/registrationCodes', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let attrs = {
      code: hex(20),
      cohortId: req.body.cohortId,
    }
    let cohort = await Cohort.findOne({
      where: { id: attrs.cohortId },
    })
    attrs.expirationDate = getRegistrationCodeExpirationDate(cohort.expirationLength)

    let registrationCode
    await sequelize.transaction(async function (transaction) {
      registrationCode = await RegistrationCode.create(attrs, { transaction })
      await updateCounts(cohort, transaction)
    })

    res.json({ success: true, registrationCode })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.patch('/registrationCodes/:id', fetchLoggedInUser, async function (req, res) {
  try {
    let code = await RegistrationCode.findOne({
      where: {
        id: req.params.id,
      },
    })
    if (!(await isManagerOfCohortOrAdmin(req.session.user, code.cohortId))) {
      res.status(403).send('')
      return
    }

    const { notes, expirationDate, status, numOfDaysActive } = req.body

    if (status) {
      await code.update({ status })

      if (status === 'disabled' && code.userId) {
        const user = await User.findOne({
          where: { id: code.userId },
          include: [
            { model: UserInformation, as: 'userInfo' },
            { model: UserInformationEuWest, as: 'userInfoEuWest' },
          ],
        })
        if (user) {
          const userInformation = getUserInfomationFromUserModel(user)
          if (userInformation) {
            userInformation.minJWTGeneratedAt = moment().toDate()
            await userInformation.save()
          }
          userSessionCache.deletePrefix(`${code.userId}:`)
        }
      }
    } else {
      await code.update({ notes, expirationDate, status, numOfDaysActive })
    }

    res.json({ success: true })
  } catch (err) {
    errorHandler(res, err)
  }
})

module.exports = router
