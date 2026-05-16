const _ = require('lodash')
const express = require('express')
const {
  fetchLoggedInUser,
  isManagerOfCohortOrAdmin,
  isManagerOrAdmin,
  errorHandler,
  serializeUser,
} = require('./api_util/api_util')
const { validateCohortAccessForResource } = require('./api_util/cohortAccessValidator')
const { v, Joi } = require('./api_util/validator')
const bodyPartSettingsService = require('./services/bodyPartSettings.service')
const { CohortStudent, User, RegistrationCode, UserInformationEuWest, UserInformation } = require('../db/models')
const { getSequelizePagination, formatPaginatedResponse } = require('./api_util/pagination')

const router = express.Router()

function studentFindParams(where) {
  return {
    where,
    attributes: ['id', 'createdAt', 'settingsFromManager'],
    include: [
      {
        model: User,
        as: 'user',
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
        model: RegistrationCode,
        as: 'registrationCode',
        attributes: ['id', 'code', 'notes', 'status', 'activationDate', 'numOfDaysActive'],
      },
    ],
    order: [['id', 'ASC']],
  }
}

function serializeCohortStudent(student) {
  return {
    ..._.pick(student, ['id', 'createdAt', 'settingsFromManager']),
    registrationCode: _.pick(student.registrationCode, [
      'id',
      'code',
      'notes',
      'status',
      'activationDate',
      'numOfDaysActive',
    ]),
    user: serializeUser(student.user),
  }
}

router.get('/cohortStudents', fetchLoggedInUser, async function (req, res) {
  let cohortId = req.query.cohortId
  // TODO Check if a manager is able to get a list of all users in the system
  if (!(await isManagerOfCohortOrAdmin(req.session.user, cohortId))) {
    res.status(403).send('')
    return
  }
  try {
    let where = {}

    if (req.query.cohortId) {
      where.cohortId = cohortId
    }

    const pagination = getSequelizePagination(req.query, { defaultLimit: 500 })

    let { rows: cohortStudents, count: total } = await CohortStudent.findAndCountAll({
      ...studentFindParams(where),
      ...pagination,
    })

    let students = cohortStudents.map(serializeCohortStudent)

    const paginationMeta = formatPaginatedResponse(students, pagination, total).pagination
    res.json({ success: true, students, pagination: paginationMeta })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.get('/cohortStudents/:id', fetchLoggedInUser, async function (req, res) {
  // TODO: only allow managers of a Cohort of that student to get their data (vs some other Manager)
  if (!(await isManagerOrAdmin(req.session.user))) {
    res.status(403).send('')
    return
  }
  try {
    let where = { id: req.params.id }

    let cohortStudent = await CohortStudent.findOne(studentFindParams(where))

    let student = serializeCohortStudent(cohortStudent)

    res.json({ success: true, student })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.patch('/cohortStudents/:id', fetchLoggedInUser, async function (req, res) {
  if (!(await isManagerOrAdmin(req.session.user))) {
    res.status(403).send('')
  } else {
    const { settingsFromManager } = req.body
    let cohortStudent = await CohortStudent.findOne({
      where: { id: req.params.id },
      attributes: ['id', 'settingsFromManager'],
    })
    Object.assign(cohortStudent.settingsFromManager, settingsFromManager)
    cohortStudent.changed('settingsFromManager', true)
    await cohortStudent.save()
    res.json({ success: true })
  }
})

// Validation schema for body part settings delta operations
const studentDeltaOperationSchema = Joi.object({
  add: Joi.array().items(Joi.number().integer()).default([]),
  remove: Joi.array().items(Joi.number().integer()).default([]),
})

const studentBodyPartSettingsValidation = {
  params: Joi.object({ id: Joi.number().integer().required() }),
  body: Joi.object({
    sandboxedBodyParts: studentDeltaOperationSchema,
    lockedBodyParts: studentDeltaOperationSchema,
    lockedRegions: studentDeltaOperationSchema,
  }).min(1),
}

/**
 * PATCH /cohortStudents/:id/body-part-settings
 * Updates body part settings for a specific student atomically using add/remove operations.
 *
 * Authorization:
 *   - Requires cohort manager role for the student's cohort, or admin
 */
router.patch(
  '/cohortStudents/:id/body-part-settings',
  fetchLoggedInUser,
  validateCohortAccessForResource({ model: CohortStudent, cohortField: 'cohortId' }),
  v(studentBodyPartSettingsValidation),
  async function (req, res) {
    try {
      const cohortStudentId = parseInt(req.params.id, 10)
      const cohortStudent = req.validatedResource || (await CohortStudent.findByPk(cohortStudentId))

      if (!cohortStudent) {
        return res.status(404).json({ success: false, error: 'Cohort student not found' })
      }

      // Must be manager of this student's cohort or admin
      if (!(await isManagerOfCohortOrAdmin(req.session.user, cohortStudent.cohortId))) {
        return res.status(403).json({
          success: false,
          error: 'You must be a manager of this cohort or an admin',
        })
      }

      const data = await bodyPartSettingsService.updateCohortStudentBodyPartSettings(cohortStudentId, req.body)
      return res.json({ success: true, data })
    } catch (err) {
      errorHandler(res, err)
    }
  }
)

module.exports = router
