// ─────────────────────────────────────────────────────────────────────────────
// notificationEvents.js
//
// High-level, domain-aware wrappers around notification.service.notifyUser().
// Each function resolves the recipients + copy for one business event and fans
// the dispatch out across in-app / email / sms channels.
//
// CONTRACT: every exported function is fire-and-forget and MUST NOT throw.
// Callers invoke them without `await` from inside request handlers — a failure
// here must never break the originating request. All bodies are wrapped in
// try/catch and resolve to undefined on error.
// ─────────────────────────────────────────────────────────────────────────────

const { Cohort, CohortStudent, CohortManager, PreparedExam } = require('../../db/models')
const { notifyUser } = require('./notification.service')
const templates = require('../../util/emailTemplates')
const logger = require('../../util/logger')

// Base URL of the frontend app, used to build deep links. Falls back to the
// production host when APP_BASE_URL is not configured.
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://app.scanlabmr.com').replace(/\/+$/, '')

/**
 * EXAM_ASSIGNED — notify every student in a cohort that new exam(s) were assigned.
 *
 * @param {number} cohortId
 * @param {number[]} examIds  - PreparedExam ids that were newly assigned
 */
async function notifyExamAssigned(cohortId, examIds) {
  try {
    if (!cohortId || !Array.isArray(examIds) || examIds.length === 0) return

    const [students, exams] = await Promise.all([
      CohortStudent.findAll({ where: { cohortId }, attributes: ['userId'] }),
      PreparedExam.findAll({ where: { id: examIds }, attributes: ['id', 'title'] }),
    ])

    const studentIds = students.map((s) => s.userId).filter((id) => Number.isInteger(id))
    if (studentIds.length === 0 || exams.length === 0) return

    const jobs = []
    for (const exam of exams) {
      const examName = exam.title || 'New exam'
      const deepLink = `${APP_BASE_URL}/exams/${exam.id}`
      const tpl = templates.examAssignedTemplate(examName, deepLink)
      for (const userId of studentIds) {
        jobs.push(
          notifyUser(userId, 'EXAM_ASSIGNED', {
            title: `New exam assigned: ${examName}`,
            message: `A new exam has been assigned to you: ${examName}`,
            deepLink,
            emailSubject: tpl.subject,
            emailHtml: tpl.html,
          })
        )
      }
    }
    await Promise.allSettled(jobs)
  } catch (err) {
    logger.error(`[notificationEvents] notifyExamAssigned failed (cohort ${cohortId}): ${err.message}`)
  }
}

/**
 * FEEDBACK_RECEIVED — notify a student that an instructor left feedback on their
 * submission. No-op when the comment author is the student themselves.
 *
 * @param {number|string} studentUserId  - owner of the test run / result
 * @param {number} commenterUserId       - user who wrote the comment
 * @param {number|null} testRunId        - optional, for a precise deep link
 */
async function notifyFeedbackReceived(studentUserId, commenterUserId, testRunId) {
  try {
    const studentId = parseInt(studentUserId, 10)
    if (!Number.isInteger(studentId)) return
    // Don't notify a student about their own reply.
    if (studentId === commenterUserId) return

    const deepLink = Number.isInteger(testRunId)
      ? `${APP_BASE_URL}/test-runs/${testRunId}`
      : `${APP_BASE_URL}/test-runs`
    const tpl = templates.feedbackReceivedTemplate('your scan submission', deepLink)

    await notifyUser(studentId, 'FEEDBACK_RECEIVED', {
      title: 'Feedback received',
      message: 'Your instructor has left feedback on your scan submission.',
      deepLink,
      emailSubject: tpl.subject,
      emailHtml: tpl.html,
    })
  } catch (err) {
    logger.error(`[notificationEvents] notifyFeedbackReceived failed (student ${studentUserId}): ${err.message}`)
  }
}

/**
 * COHORT_ACCOUNT_OPENED — welcome a newly registered student to their cohort.
 *
 * @param {number} userId
 * @param {number} cohortId
 */
async function notifyCohortAccountOpened(userId, cohortId) {
  try {
    if (!Number.isInteger(userId)) return

    const cohort = cohortId ? await Cohort.findByPk(cohortId, { attributes: ['id', 'name'] }) : null
    const cohortName = (cohort && cohort.name) || 'your cohort'
    const deepLink = APP_BASE_URL
    const tpl = templates.cohortAccountOpenedTemplate(cohortName, deepLink)

    await notifyUser(userId, 'COHORT_ACCOUNT_OPENED', {
      title: 'Your ScanLab account is ready',
      message: `Your ScanLab account for ${cohortName} is now open and ready to use.`,
      deepLink,
      emailSubject: tpl.subject,
      emailHtml: tpl.html,
    })
  } catch (err) {
    logger.error(`[notificationEvents] notifyCohortAccountOpened failed (user ${userId}): ${err.message}`)
  }
}

/**
 * ACCOUNT_CREATED — notify a cohort's managers that a new student account was
 * created in their cohort.
 *
 * @param {number} cohortId
 * @param {string} newUserName  - legal name of the newly created student
 */
async function notifyAccountCreated(cohortId, newUserName) {
  try {
    if (!cohortId) return

    const [cohort, managers] = await Promise.all([
      Cohort.findByPk(cohortId, { attributes: ['id', 'name'] }),
      CohortManager.findAll({ where: { cohortId }, attributes: ['userId'] }),
    ])

    const managerIds = managers.map((m) => m.userId).filter((id) => Number.isInteger(id))
    if (managerIds.length === 0) return

    const cohortName = (cohort && cohort.name) || 'your cohort'
    const studentName = newUserName || 'A new student'
    const deepLink = `${APP_BASE_URL}/cohorts/${cohortId}`

    await Promise.allSettled(
      managerIds.map((userId) =>
        notifyUser(userId, 'ACCOUNT_CREATED', {
          title: 'New student account created',
          message: `${studentName} created an account in cohort "${cohortName}".`,
          deepLink,
          emailSubject: 'A new student joined your cohort',
          emailHtml: `<p><strong>${studentName}</strong> has created an account in your cohort <strong>${cohortName}</strong>.</p><p><a href="${deepLink}">View the cohort in ScanLab</a></p>`,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyAccountCreated failed (cohort ${cohortId}): ${err.message}`)
  }
}

module.exports = {
  notifyExamAssigned,
  notifyFeedbackReceived,
  notifyCohortAccountOpened,
  notifyAccountCreated,
}
