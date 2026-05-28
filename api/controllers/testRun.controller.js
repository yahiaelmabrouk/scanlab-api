const _ = require('lodash')
const router = require('express').Router()
const { fetchLoggedInUser, requireAdmin, getUserInfomationFromUserModel } = require('../api_util/api_util')
const testSvc = require('../services/testRun.service')
const { NoQuestionSetAvailableError } = testSvc
const cohortsSvc = require('../services/cohorts.service')
const patientPhysioSvc = require('../services/patientPhysio.service')
const notificationEvents = require('../services/notificationEvents')
const { PreparedExam } = require('../../db/models')
const { CLIENT_PRODUCTION_HOSTNAMES } = require('../../util/constants')
const statsCacheHelper = require('../statsCacheHelper')

const paths = {
  testStart: '/tests/start',
  testAddAnswer: '/tests/:id/addAnswer',
  testAddMultiAnswers: '/tests/:id/addMultiAnswers',
  testSubmit: '/tests/:id/submit',
  testRegrade: '/tests/:id/regrade',
  testSample: '/tests/sample',
}

// Begin Test
router.post(paths.testStart, fetchLoggedInUser, async function (req, res) {
  const { userId } = req.session
  const { bodyPartId, preparedExam, isCTLab } = req.body
  const cohorts = await cohortsSvc.findAllCohorts(req.session.user, false, true)

  // TODO: Smarter way of selecting cohort needed?
  const cohort = _.first(cohorts)

  if (preparedExam) {
    const persistedPreparedExam = await PreparedExam.findByPk(preparedExam.id)
    const assignedPatientPhysioId = _.get(persistedPreparedExam, 'patientPhysioId')
    const patientPhysio =
      assignedPatientPhysioId != null
        ? await patientPhysioSvc.getPatientPhysioByIdWithInitialLevel(assignedPatientPhysioId).catch((err) => {
            console.error('assigned patientPhysio resolution failed', err, {
              preparedExamId: preparedExam.id,
              patientPhysioId: assignedPatientPhysioId,
            })
            return null
          })
        : await patientPhysioSvc.getRandomPatientPhysio().catch((err) => {
            console.error('getRandomPatientPhysio failed', err)
            return null
          })

    if (preparedExam.isDynamic) {
      // This is the business logic to start a dynamic prepared exam
      const questions = await testSvc.generatePreparedExamTestQuestionsDynamically(preparedExam, userId).catch()
      const testRun = await testSvc.startTestRun(
        req.session.user.id,
        questions,
        cohort,
        null,
        false,
        preparedExam.id,
        preparedExam.softwareVendor,
        preparedExam.softwareVersion
      )
      return res.json({ success: true, testRun, patientPhysio })
    } else {
      // This is the business logic to start a classic prepared exam
      const questions = await testSvc.generatePreparedExamTestQuestions(preparedExam).catch()
      const testRun = await testSvc.startTestRun(
        req.session.user.id,
        questions,
        cohort,
        null,
        false,
        preparedExam.id,
        preparedExam.softwareVendor,
        preparedExam.softwareVersion
      )
      return res.json({ success: true, testRun, patientPhysio })
    }
  }

  try {
    const questions = await testSvc.generateTestQuestions(userId, cohort, bodyPartId, isCTLab)

    const testRun = await testSvc.startTestRun(req.session.user.id, questions, cohort, bodyPartId, false)
    const userInformation = getUserInfomationFromUserModel(req.session.user)

    let { preferredAnswerCriteriaByStackQuestionId, preferredTimingMethod } = userInformation

    return res.json({ success: true, testRun, preferredAnswerCriteriaByStackQuestionId, preferredTimingMethod })
  } catch (error) {
    if (error instanceof NoQuestionSetAvailableError) {
      return res.status(404).json({ success: false, error: error.message })
    }
    console.error('Something went wrong', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Add Answer to Test
router.post(paths.testAddAnswer, fetchLoggedInUser, async function (req, res) {
  try {
    const { answer } = req.body
    const test = await testSvc.addAnswer(req.params.id, answer, req.session.user)
    return res.json({ success: true, test })
  } catch (err) {
    console.error('addAnswer failed:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})


// Add Multiple Answers to Test
router.post(paths.testAddMultiAnswers, fetchLoggedInUser, async (req, res) => {
  try {
    const { answers } = req.body
    const test = await testSvc.addMultiAnswers(req.params.id, answers, req.session.user)
    return res.json({ success: true, test })
  } catch (err) {
    console.error('addMultiAnswers failed:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// Submit Test
// secondsActive should be encrypted to prevent cheating
router.post(paths.testSubmit, fetchLoggedInUser, async function (req, res) {
  // Parse text/plain body as JSON (for sendBeacon which can't use application/json without CORS preflight)
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const { secondsActive } = body
  const { isChallengeMode, isCTLab } = req.query
  let testRunResults = await testSvc.submitTestRun(
    req.params.id,
    secondsActive,
    new Date(),
    false,
    isChallengeMode,
    null,
    isCTLab == 1,
    CLIENT_PRODUCTION_HOSTNAMES.includes(req.hostname),
    req.session.user.id
  )
  delete testRunResults.isChallengeMode

  res.json({
    success: true,
    ...testRunResults,
  })


  // >>> mark this user's cache rows as dirty so next read will rebuild
  setImmediate(async () => {
    try {
      await statsCacheHelper.flagCachesDirtyAfterSubmission(
        req.session.user.id,
        isChallengeMode,
        null
      )
    } catch (err) {
      console.log('flagCachesDirtyAfterSubmission failed', err)
    }
  })

  // Fire-and-forget: if this submission was a prepared exam, notify the student's
  // cohort manager(s). No-ops for regular/sandbox runs (no preparedExamId).
  notificationEvents.notifyPreparedExamCompleted(req.session.user.id, req.params.id)
})

// Regrade Test
router.post(paths.testRegrade, fetchLoggedInUser, requireAdmin, async function (req, res) {
  const { isCTLab } = req.query
  return res.json({
    success: true,
    ...(await testSvc.regrade(
      req.params.id,
      null,
      isCTLab == 1,
      CLIENT_PRODUCTION_HOSTNAMES.includes(req.hostname),
      req.session.user.id
    )),
  })
})

module.exports = router

// sample dynamic prepared exam quesitons for testing only
router.get(paths.testSample, fetchLoggedInUser, async function (req, res) {
  //return res.json({ success: true, sample: await testSvc.sample() })
  const { userId } = req.session
  const { bodyPartId, preparedExam } = req.body
  const cohorts = await cohortsSvc.findAllCohorts(req.session.user, false, true)
  let output = {
    userId,
    bodyPartId,
    preparedExam,
    cohorts,
  }

  if (preparedExam) {
    if (preparedExam.isDynamic) {
      console.log('dynamic test')
      output.questions = await testSvc.generatePreparedExamTestQuestionsDynamically(preparedExam, userId).catch()
    } else {
      console.log('non dynamic test')
    }
  }
  return res.json({ success: true, sample: output.questions })
})
