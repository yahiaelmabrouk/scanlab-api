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

const moment = require('moment/moment')
const { Cohort, CohortStudent, CohortManager, PreparedExam, RegistrationCode } = require('../../db/models')
const { Op } = require('sequelize')
const { notifyUser, getAccountExpiryNoticeDays } = require('./notification.service')
const { getRegistrationCodeExpirationDate } = require('../api_util/registrationCode')
const ModelProvider = require('../providers/model.provider')
const templates = require('../../util/emailTemplates')
const logger = require('../../util/logger')

/**
 * Resolve a user's display name (legalName) across both regional UserInformation
 * tables. Best-effort: returns null on any failure so callers can fall back.
 */
async function resolveUserName(userId) {
  try {
    const info = await ModelProvider.findUserInfomationBySequelizeWhere({ userId })
    return (info && info.legalName) || null
  } catch (err) {
    return null
  }
}

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
      const tpl = templates.examAssignedTemplate(examName)
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
    const tpl = templates.feedbackReceivedTemplate('your scan submission')

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
    const tpl = templates.cohortAccountOpenedTemplate(cohortName)

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
          emailHtml: `<p><strong>${studentName}</strong> has created an account in your cohort <strong>${cohortName}</strong>.</p>`,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyAccountCreated failed (cohort ${cohortId}): ${err.message}`)
  }
}

/**
 * EXAM_UNLOCKED — notify students that the cohort manager unlocked exam(s)
 * (body parts and/or regions) previously locked.
 *
 * @param {number[]} userIds   - recipient user ids (all affected students)
 * @param {string[]} examNames - human-readable names of the unlocked items
 */
async function notifyExamUnlocked(userIds, examNames) {
  try {
    const ids = (userIds || []).filter((id) => Number.isInteger(id))
    const names = (examNames || []).filter(Boolean)
    if (ids.length === 0 || names.length === 0) return

    const list = names.join(', ')
    const plural = names.length > 1 ? 's' : ''
    const tpl = templates.examUnlockedTemplate(list)
    const deepLink = APP_BASE_URL

    await Promise.allSettled(
      ids.map((userId) =>
        notifyUser(userId, 'EXAM_UNLOCKED', {
          title: `New exam${plural} unlocked`,
          message: `Your instructor unlocked: ${list}.`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyExamUnlocked failed: ${err.message}`)
  }
}

/**
 * EXAM_SANDBOX_ENABLED — notify students that exam(s) were put into sandbox mode.
 *
 * @param {number[]} userIds
 * @param {string[]} examNames
 */
async function notifyExamSandboxEnabled(userIds, examNames) {
  try {
    const ids = (userIds || []).filter((id) => Number.isInteger(id))
    const names = (examNames || []).filter(Boolean)
    if (ids.length === 0 || names.length === 0) return

    const list = names.join(', ')
    const tpl = templates.examSandboxEnabledTemplate(list)
    const deepLink = APP_BASE_URL

    await Promise.allSettled(
      ids.map((userId) =>
        notifyUser(userId, 'EXAM_SANDBOX_ENABLED', {
          title: 'Sandbox mode enabled',
          message: `Sandbox mode is now enabled for: ${list}.`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyExamSandboxEnabled failed: ${err.message}`)
  }
}

/**
 * EXAM_SANDBOX_DISABLED — notify students that exam(s) were removed from sandbox mode.
 *
 * @param {number[]} userIds
 * @param {string[]} examNames
 */
async function notifyExamSandboxDisabled(userIds, examNames) {
  try {
    const ids = (userIds || []).filter((id) => Number.isInteger(id))
    const names = (examNames || []).filter(Boolean)
    if (ids.length === 0 || names.length === 0) return

    const list = names.join(', ')
    const tpl = templates.examSandboxDisabledTemplate(list)
    const deepLink = APP_BASE_URL

    await Promise.allSettled(
      ids.map((userId) =>
        notifyUser(userId, 'EXAM_SANDBOX_DISABLED', {
          title: 'Sandbox mode disabled',
          message: `Sandbox mode has been turned off for: ${list}.`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyExamSandboxDisabled failed: ${err.message}`)
  }
}

/**
 * FEEDBACK_REPLIED — notify the cohort manager(s) / instructor(s) who left feedback
 * that the student has responded to it.
 *
 * @param {number} studentUserId        - the student who wrote the reply
 * @param {number[]} feedbackAuthorIds  - user ids of the prior (non-student) commenters
 * @param {number|null} testRunId       - optional, for a precise deep link
 */
async function notifyFeedbackReplied(studentUserId, feedbackAuthorIds, testRunId) {
  try {
    const studentId = parseInt(studentUserId, 10)
    if (!Number.isInteger(studentId)) return

    const authorIds = [
      ...new Set((feedbackAuthorIds || []).map((id) => parseInt(id, 10)).filter(Number.isInteger)),
    ].filter((id) => id !== studentId)
    if (authorIds.length === 0) return

    const studentName = (await resolveUserName(studentId)) || 'A student'
    const runId = parseInt(testRunId, 10)
    const deepLink = Number.isInteger(runId) ? `${APP_BASE_URL}/test-runs/${runId}` : `${APP_BASE_URL}/test-runs`
    const tpl = templates.feedbackRepliedTemplate(studentName)

    await Promise.allSettled(
      authorIds.map((userId) =>
        notifyUser(userId, 'FEEDBACK_REPLIED', {
          title: 'Feedback reply',
          message: `${studentName} responded to your feedback!`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyFeedbackReplied failed (student ${studentUserId}): ${err.message}`)
  }
}

/**
 * STUDENT_EXAM_COMPLETED — notify the cohort manager(s) that a student completed a
 * prepared exam. No-op for non-prepared-exam (regular/sandbox) test runs.
 *
 * @param {number} studentUserId - the student who completed the exam
 * @param {number} testRunId     - the submitted test run id
 */
async function notifyPreparedExamCompleted(studentUserId, testRunId) {
  try {
    const studentId = parseInt(studentUserId, 10)
    const runId = parseInt(testRunId, 10)
    if (!Number.isInteger(studentId) || !Number.isInteger(runId)) return

    const modelProvider = await ModelProvider.getModelProvider(studentId)
    const testRun = await modelProvider.TestRun.findByPk(runId, {
      attributes: ['id', 'preparedExamId', 'userId'],
    })
    // Only prepared-exam runs trigger this; regular/sandbox runs have no preparedExamId.
    if (!testRun || !testRun.preparedExamId) return

    const [preparedExam, studentCohorts] = await Promise.all([
      PreparedExam.findByPk(testRun.preparedExamId, { attributes: ['id', 'title'] }),
      CohortStudent.findAll({ where: { userId: studentId }, attributes: ['cohortId'] }),
    ])

    const cohortIds = [...new Set(studentCohorts.map((c) => c.cohortId).filter(Number.isInteger))]
    if (cohortIds.length === 0) return

    const managers = await CohortManager.findAll({ where: { cohortId: cohortIds }, attributes: ['userId'] })
    const managerIds = [...new Set(managers.map((m) => m.userId).filter(Number.isInteger))].filter(
      (id) => id !== studentId
    )
    if (managerIds.length === 0) return

    const examName = (preparedExam && preparedExam.title) || 'a prepared exam'
    const studentName = (await resolveUserName(studentId)) || 'A student'
    const deepLink = `${APP_BASE_URL}/cohorts/${cohortIds[0]}`
    const tpl = templates.studentExamCompletedTemplate(studentName, examName)

    await Promise.allSettled(
      managerIds.map((userId) =>
        notifyUser(userId, 'STUDENT_EXAM_COMPLETED', {
          title: 'Prepared exam completed',
          message: `${studentName} completed a prepared exam of ${examName}`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyPreparedExamCompleted failed (student ${studentUserId}): ${err.message}`)
  }
}

/**
 * NEW_FEATURE — broadcast a "new feature" announcement to every enrolled student.
 * Triggered by an admin from the announcements page.
 *
 * @param {string} featureName - name of the released feature
 */
async function notifyNewFeature(featureName) {
  try {
    const name = (featureName || '').trim()
    if (!name) return

    const students = await CohortStudent.findAll({ attributes: ['userId'] })
    const userIds = [...new Set(students.map((s) => s.userId).filter(Number.isInteger))]
    if (userIds.length === 0) return

    const tpl = templates.newFeatureTemplate(name)
    const deepLink = APP_BASE_URL

    await Promise.allSettled(
      userIds.map((userId) =>
        notifyUser(userId, 'NEW_FEATURE', {
          title: 'New feature available',
          message: `A new feature is now available: ${name}`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyNewFeature failed: ${err.message}`)
  }
}

/**
 * KNOWN_BUG — broadcast a "known issue" announcement to every enrolled student.
 * Triggered by an admin from the announcements page.
 *
 * @param {string} bugDescription - short description of the known issue
 */
async function notifyKnownBug(bugDescription) {
  try {
    const description = (bugDescription || '').trim()
    if (!description) return

    const students = await CohortStudent.findAll({ attributes: ['userId'] })
    const userIds = [...new Set(students.map((s) => s.userId).filter(Number.isInteger))]
    if (userIds.length === 0) return

    const tpl = templates.knownBugTemplate(description)
    const deepLink = APP_BASE_URL

    await Promise.allSettled(
      userIds.map((userId) =>
        notifyUser(userId, 'KNOWN_BUG', {
          title: 'Known issue',
          message: `We're aware of an issue: ${description}`,
          deepLink,
          emailSubject: tpl.subject,
          emailHtml: tpl.html,
        })
      )
    )
  } catch (err) {
    logger.error(`[notificationEvents] notifyKnownBug failed: ${err.message}`)
  }
}

/**
 * ACCOUNT_EXPIRING — notify a single student that their account is about to expire.
 *
 * @param {number} userId
 * @param {number} daysRemaining - whole days until the account expires
 */
async function notifyAccountExpiring(userId, daysRemaining) {
  try {
    const id = parseInt(userId, 10)
    const days = parseInt(daysRemaining, 10)
    if (!Number.isInteger(id) || !Number.isInteger(days) || days <= 0) return

    const dayWord = days === 1 ? 'day' : 'days'
    const tpl = templates.accountExpiringTemplate(days)

    await notifyUser(id, 'ACCOUNT_EXPIRING', {
      title: 'Account expiring soon',
      message: `Your account will expire in ${days} ${dayWord}.`,
      deepLink: APP_BASE_URL,
      emailSubject: tpl.subject,
      emailHtml: tpl.html,
    })
  } catch (err) {
    logger.error(`[notificationEvents] notifyAccountExpiring failed (user ${userId}): ${err.message}`)
  }
}

/**
 * Daily scan: notify every student whose account expires in exactly N days, where
 * N is the admin-configured threshold. Each qualifying student crosses the N-day
 * mark on exactly one calendar day, so this fires at most one notification per
 * student per expiry cycle. Intended to be run once per day by the scheduler.
 */
async function runAccountExpiryScan() {
  try {
    const noticeDays = await getAccountExpiryNoticeDays()
    if (!Number.isInteger(noticeDays) || noticeDays <= 0) return

    const codes = await RegistrationCode.findAll({
      where: {
        status: 'active',
        userId: { [Op.ne]: null },
        activationDate: { [Op.ne]: null },
      },
      attributes: ['userId', 'activationDate', 'numOfDaysActive'],
    })

    const today = moment().startOf('day')
    const seen = new Set()
    const jobs = []

    for (const code of codes) {
      const userId = parseInt(code.userId, 10)
      if (!Number.isInteger(userId) || seen.has(userId)) continue

      const expiration = getRegistrationCodeExpirationDate(code.numOfDaysActive, code.activationDate)
      const daysRemaining = moment(expiration).startOf('day').diff(today, 'days')
      if (daysRemaining !== noticeDays) continue

      seen.add(userId)
      jobs.push(notifyAccountExpiring(userId, daysRemaining))
    }

    if (jobs.length > 0) {
      logger.info(`[notificationEvents] runAccountExpiryScan: notifying ${jobs.length} student(s) expiring in ${noticeDays} day(s)`)
      await Promise.allSettled(jobs)
    }
  } catch (err) {
    logger.error(`[notificationEvents] runAccountExpiryScan failed: ${err.message}`)
  }
}

module.exports = {
  notifyExamAssigned,
  notifyFeedbackReceived,
  notifyCohortAccountOpened,
  notifyAccountCreated,
  notifyExamUnlocked,
  notifyExamSandboxEnabled,
  notifyExamSandboxDisabled,
  notifyFeedbackReplied,
  notifyPreparedExamCompleted,
  notifyNewFeature,
  notifyKnownBug,
  notifyAccountExpiring,
  runAccountExpiryScan,
}
