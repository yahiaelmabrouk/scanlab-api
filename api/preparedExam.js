const express = require('express')
const { requireAdmin, fetchLoggedInUser } = require('./api_util/api_util')
const { PreparedExam, PatientPhysio, Sequelize, CohortPreparedExam, sequelize } = require('../db/models')
const ModelProvider = require('./providers/model.provider')

const Op = Sequelize.Op

const router = express.Router()

router.get('/prepared-exams', fetchLoggedInUser, requireAdmin, async function (req, res) {
  const exams = await PreparedExam.findAll({
    order: [['id', 'ASC']],
    include: [{ model: PatientPhysio, as: 'patientPhysio' }],
  })
  res.json({ success: true, exams })
})

router.get('/prepared-exams/:cohortId', fetchLoggedInUser, async function (req, res) {
  const { cohortId } = req.params
  const cohortsPreparedExams = await CohortPreparedExam.findAll({ where: { cohortId: parseInt(cohortId) } })
  const preparedExamIds = cohortsPreparedExams.map((exam) => exam.dataValues.examId)
  if (preparedExamIds.length > 0) {
    const where = { id: { [Op.or]: preparedExamIds }, published: true }
    if (req.query.type === 'skill') {
      where.isSkill = true
    } else if (req.query.type === 'hiring') {
      where.isHiring = true
    }
    const exams = await PreparedExam.findAll({
      where,
      order: [['id', 'ASC']],
    })
    res.json({ success: true, exams })
  } else {
    res.json({ success: true, exams: [] })
  }
})

router.post('/prepared-exams', fetchLoggedInUser, async function (req, res) {
  const preparedExam = await PreparedExam.create({ title: req.body.name })
  res.json({ success: true, exam: preparedExam })
})

router.patch('/prepared-exams/:id', fetchLoggedInUser, async function (req, res) {
  const patchedExam = await PreparedExam.findByPk(req.params.id)

  let {
    published,
    preTestQuestions,
    postTestQuestions,
    questionSetId,
    isSkill,
    isHiring,
    isDynamic,
    regionId,
    bodyPartId,
    postQuestionCount,
    postQuestionBodyPartCount,
    preQuestionGroupId,
    postQuestionGroupId,
    patientPhysioId,
  } = req.body

  // at least one must be true, and isSkill is default?
  // if (!isHiring && !isSkill) {
  //   isSkill = true
  // }

  if (patientPhysioId !== undefined && patientPhysioId !== null) {
    if (!Number.isInteger(patientPhysioId)) {
      return res.status(400).json({ success: false, error: 'patientPhysioId must be an integer' })
    }
    const patientPhysio = await PatientPhysio.findByPk(patientPhysioId)
    if (!patientPhysio) {
      return res.status(400).json({ success: false, error: `PatientPhysio with id ${patientPhysioId} not found` })
    }
  }

  if (questionSetId) patchedExam.questions.questionSetId = questionSetId
  patchedExam.questions.preTestQuestions = preTestQuestions
  patchedExam.questions.postTestQuestions = postTestQuestions
  patchedExam.changed('questions', true)
  patchedExam.published = published
  patchedExam.isSkill = isSkill || false
  patchedExam.isHiring = isHiring || false
  patchedExam.isDynamic = isDynamic || false
  patchedExam.regionId = regionId
  patchedExam.bodyPartId = bodyPartId
  patchedExam.postQuestionCount = postQuestionCount
  patchedExam.postQuestionBodyPartCount = postQuestionBodyPartCount
  patchedExam.preQuestionGroupId = preQuestionGroupId
  patchedExam.postQuestionGroupId = postQuestionGroupId
  if (patientPhysioId !== undefined) {
    patchedExam.patientPhysioId = patientPhysioId
  }

  await patchedExam.save()
  res.json({ success: true, exam: patchedExam })
})

router.get('/prepared-exams/taken/:cohortId', fetchLoggedInUser, async function (req, res) {
  const { cohortId } = req.params

  const cohortsPreparedExams = await CohortPreparedExam.findAll({ where: { cohortId: parseInt(cohortId) } })
  const preparedExamIds = cohortsPreparedExams.map((exam) => exam.dataValues.examId)

  const preparedTestsTakenSql = `
    ${ModelProvider.generateCombinedQuery([
      {
        tableName: 'TestRuns',
        where: { userId: req.user.id, preparedExamId: { [Op.not]: null }, timeEnded: { [Op.not]: null } },
      },
    ])}
    SELECT *
    FROM "CombinedTestRuns"
    WHERE
      "userId" = :userId
      AND "preparedExamId" IS NOT NULL
      AND "timeEnded" IS NOT NULL
  `
  const preparedTestsTaken = await sequelize.query(preparedTestsTakenSql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { userId: req.user.id },
  })

  const preparedTestsTakenIDs = preparedTestsTaken.map((t) => t.preparedExamId)

  const takenExams = preparedExamIds.filter((testId) => preparedTestsTakenIDs.includes(testId))

  res.json({ success: true, takenExams })
})

module.exports = router
