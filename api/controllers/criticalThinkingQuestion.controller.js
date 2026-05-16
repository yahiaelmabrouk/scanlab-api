const router = require('express').Router()
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')
const criticalThinkingQuestionSvc = require('../services/criticalThinkingQuestion.service')

const paths = {
  questions: '/multipleChoiceQuestions',
  questionsList: '/multipleChoiceQuestions/list',
  questionsOne: '/multipleChoiceQuestions/:id',
  questionsMedia: '/multipleChoiceQuestions/:id/media',
  questionsReport: '/multipleChoiceQuestions/:id/report',
}

// Get Question Media
router.get(paths.questionsMedia, async function (req, res) {
  res.json({ success: true, media: await criticalThinkingQuestionSvc.getMedia(req.params.id) })
})

// Delete Question Media
router.delete(paths.questionsMedia, fetchLoggedInUser, requireAdmin, async function (req, res) {
  criticalThinkingQuestionSvc.deleteMedia(req.params.id)
  res.json({ success: true })
})

// Create Question Media, Uploading based on DICOM uploading
router.post(paths.questionsMedia, fetchLoggedInUser, requireAdmin, async function (req, res) {
  // In the format for use with Vue2Dropzone:
  // https://rowanwins.github.io/vue-dropzone/docs/dist/#/aws-s3-upload
  res.json(await criticalThinkingQuestionSvc.uploadMediaForQuestion(req.params.id, req.query.filename))
})

// Get Questions List (lightweight, no media/S3 calls)
router.get(paths.questionsList, async function (req, res) {
  const { type } = req.query
  res.json({
    success: true,
    multipleChoiceQuestions: await criticalThinkingQuestionSvc.listCriticalThinkingQuestions(type),
  })
})

// Get All Questions
router.get(paths.questions, async function (req, res) {
  const { type } = req.query

  res.json({
    success: true,
    multipleChoiceQuestions: await criticalThinkingQuestionSvc.getAllCriticalThinkingQuestions(type),
  })
})

// Get One Question
router.get(paths.questionsOne, async function (req, res) {
  res.json({
    success: true,
    multipleChoiceQuestion: await criticalThinkingQuestionSvc.getCriticalThinkingQuestion(req.params.id),
  })
})

// Create One Question
router.post(paths.questions, fetchLoggedInUser, requireAdmin, async function (req, res) {
  const returnVal = await criticalThinkingQuestionSvc.newCriticalThinkingQuestion(req.body)
  res.json({ success: true, ...returnVal })
})

// Edit One Question
router.post(paths.questionsOne, fetchLoggedInUser, requireAdmin, async function (req, res) {
  const returnVal = await criticalThinkingQuestionSvc.modifyCriticalThinkingQuestion(req.body)
  res.json({ success: true, ...returnVal })
})

// Delete One Question
router.delete(paths.questionsOne, fetchLoggedInUser, requireAdmin, async function (req, res) {
  await criticalThinkingQuestionSvc.deleteCriticalThinkingQuestion(req.params.id)
  res.json({ success: true })
})

// Create user report for question
router.post(paths.questionsReport, fetchLoggedInUser, async function (req, res) {
  const { userId } = req.session
  const success = await criticalThinkingQuestionSvc.reportCriticalThinkingQuestion(
    req.params.id,
    userId,
    req.body.feedback,
    req.body.isCTLab
  )
  res.json({ success })
})

module.exports = router
