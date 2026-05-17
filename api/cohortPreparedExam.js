const express = require('express')

const { fetchLoggedInUser } = require('./api_util/api_util')
const notificationEvents = require('./services/notificationEvents')

const { CohortPreparedExam } = require('../db/models')

const router = express.Router()

router.get('/cohort-prepared-exams/:id', fetchLoggedInUser, async function (req, res) {
  const cohortId = parseInt(req.params.id, 10)
  if (!Number.isInteger(cohortId)) {
    return res.status(400).json({ success: false, error: 'Invalid cohort id' })
  }
  const cohortPreparedExams = await CohortPreparedExam.findAll({ where: { cohortId } })
  res.json({ success: true, cohortPreparedExams })
})

router.post('/cohort-prepared-exams', fetchLoggedInUser, async function (req, res) {
  const { ids, cohortId } = req.body
  const preparedExams = await CohortPreparedExam.findAll({
    where: {
      cohortId,
    },
  })

  const createdExams = []

  for (let preparedExamId of ids) {
    const previouslyCreatedCohortPreparedExamsDoNotIncludeThisExamId = !preparedExams.some(
      (e) => e.examId === preparedExamId
    )
    if (previouslyCreatedCohortPreparedExamsDoNotIncludeThisExamId) {
      const e = await CohortPreparedExam.create({ cohortId, examId: preparedExamId })
      createdExams.push(e)
    }
  }

  for (let exam of preparedExams) {
    if (!ids.includes(exam.examId)) await exam.destroy()
  }

  // Fire-and-forget: notify cohort students of newly assigned exams.
  if (createdExams.length > 0) {
    notificationEvents.notifyExamAssigned(
      cohortId,
      createdExams.map((e) => e.examId)
    )
  }

  res.json({ success: true, preparedExams: createdExams })
})

module.exports = router
