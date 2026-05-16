const express = require('express')

const { fetchLoggedInUser } = require('./api_util/api_util')
const { CohortPreparedExam, CohortStudent, PreparedExam } = require('../db/models')
const { notifyUser } = require('./services/notification.service')
const { examAssignedTemplate } = require('../util/emailTemplates')
const logger = require('../util/logger')

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

  // Fire-and-forget: notify each student in the cohort for each newly assigned exam
  if (createdExams.length > 0) {
    const origin = req.get('origin') || process.env.APP_BASE_URL || 'https://app.scanlabmr.com'
    setImmediate(async () => {
      try {
        const [students, examRecords] = await Promise.all([
          CohortStudent.findAll({
            where: { cohortId },
            attributes: ['userId'],
          }),
          PreparedExam.findAll({
            where: { id: createdExams.map((e) => e.examId) },
            attributes: ['id', 'title'],
          }),
        ])

        const examMap = Object.fromEntries(examRecords.map((e) => [e.id, e.title]))

        for (const student of students) {
          if (!student.userId) continue
          for (const exam of createdExams) {
            const examName = examMap[exam.examId] || 'New Exam'
            const deepLink = `${origin}/exams/${exam.examId}`
            const { subject, html } = examAssignedTemplate(examName, deepLink)
            notifyUser(student.userId, 'EXAM_ASSIGNED', {
              title: `New exam assigned: ${examName}`,
              message: `A new exam has been assigned to you: ${examName}`,
              deepLink,
              emailSubject: subject,
              emailHtml: html,
            }).catch((err) => logger.error(`[EXAM_ASSIGNED] notify failed for user ${student.userId}: ${err.message}`))
          }
        }
      } catch (err) {
        logger.error(`[EXAM_ASSIGNED] trigger failed: ${err.message}`)
      }
    })
  }

  res.json({ success: true, preparedExams: createdExams })
})

module.exports = router
