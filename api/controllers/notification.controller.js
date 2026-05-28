const express = require('express')
const router = express.Router()
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')
const { v, Joi } = require('../api_util/validator')
const svc = require('../services/notification.service')
const notificationEvents = require('../services/notificationEvents')
const logger = require('../../util/logger')

// All notification event types. Keep in sync with the NotificationType enum.
const NOTIFICATION_EVENT_TYPES = [
  'EXAM_ASSIGNED',
  'FEEDBACK_RECEIVED',
  'ACCOUNT_CREATED',
  'COHORT_ACCOUNT_OPENED',
  'EXAM_UNLOCKED',
  'EXAM_SANDBOX_ENABLED',
  'EXAM_SANDBOX_DISABLED',
  'FEEDBACK_REPLIED',
  'STUDENT_EXAM_COMPLETED',
  'NEW_FEATURE',
  'KNOWN_BUG',
  'ACCOUNT_EXPIRING',
]

// ─────────────────────────────────────────────────────────────────────────────
// In-app notifications
// ─────────────────────────────────────────────────────────────────────────────

const notificationsQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
}

// GET /notifications — paginated list, newest first
router.get('/notifications', fetchLoggedInUser, v(notificationsQuerySchema), async function (req, res) {
  const userId = req.user.id
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 20
  const result = await svc.getNotifications(userId, { page, limit })
  res.json({ success: true, ...result })
})

// GET /notifications/unread-count — badge count (must come before /:id)
router.get('/notifications/unread-count', fetchLoggedInUser, async function (req, res) {
  const result = await svc.getUnreadCount(req.user.id)
  res.json({ success: true, ...result })
})

// PATCH /notifications/read-all — bulk mark read (must come before /:id)
router.patch('/notifications/read-all', fetchLoggedInUser, async function (req, res) {
  await svc.markAllRead(req.user.id)
  res.json({ success: true })
})

// PATCH /notifications/:id/read — mark single notification read
router.patch('/notifications/:id/read', fetchLoggedInUser, async function (req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, error: 'Invalid notification id' })
  }
  try {
    await svc.markOneRead(id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    res.status(status).json({ success: false, error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Notification preferences
// ─────────────────────────────────────────────────────────────────────────────

// GET /notification-preferences — current user's preferences
router.get('/notification-preferences', fetchLoggedInUser, async function (req, res) {
  const preferences = await svc.getPreferences(req.user.id)
  res.json({ success: true, preferences })
})

const preferencesBodySchema = {
  body: Joi.object({
    preferences: Joi.array()
      .items(
        Joi.object({
          eventType: Joi.string()
            .valid(...NOTIFICATION_EVENT_TYPES)
            .required(),
          channel: Joi.string().valid('in_app', 'email', 'sms').required(),
          enabled: Joi.boolean().required(),
        })
      )
      .min(1)
      .required(),
  }),
}

// PUT /notification-preferences — upsert preferences
router.put('/notification-preferences', fetchLoggedInUser, v(preferencesBodySchema), async function (req, res) {
  const preferences = await svc.upsertPreferences(req.user.id, req.body.preferences)
  res.json({ success: true, preferences })
})

// GET /phone/status — returns current phone number and verification state
router.get('/phone/status', fetchLoggedInUser, async function (req, res) {
  const phone = await svc.getPhoneStatus(req.user.id)
  res.json({ success: true, phone })
})

const setPhoneSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().min(7).max(20).required(),
    countryCode: Joi.string().min(1).max(5).required(),
  }),
}

// POST /phone/set — register a phone number (saved as verified immediately)
router.post('/phone/set', fetchLoggedInUser, v(setPhoneSchema), async function (req, res) {
  const { phoneNumber, countryCode } = req.body
  try {
    await svc.setPhoneDirect(req.user.id, phoneNumber, countryCode)
    res.json({ success: true })
  } catch (err) {
    const status = err.status || 500
    res.status(status).json({ success: false, error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin announcements
// ─────────────────────────────────────────────────────────────────────────────

const newFeatureSchema = {
  body: Joi.object({
    featureName: Joi.string().trim().min(1).max(120).required(),
  }),
}

// POST /announcements/new-feature — admin broadcasts a "new feature" notification
// to every enrolled student. Fire-and-forget fan-out; responds immediately.
router.post(
  '/announcements/new-feature',
  fetchLoggedInUser,
  requireAdmin,
  v(newFeatureSchema),
  async function (req, res) {
    const featureName = req.body.featureName.trim()
    // Fire-and-forget per notificationEvents.js contract — must NOT await.
    // The fan-out includes email/SMS which can block on slow/unreachable
    // upstreams; awaiting it would hang the request and the proxy returns 500.
    notificationEvents.notifyNewFeature(featureName)
    res.json({ success: true })
  }
)

const knownBugSchema = {
  body: Joi.object({
    bugDescription: Joi.string().trim().min(1).max(280).required(),
  }),
}

// POST /announcements/known-bug — admin broadcasts a "known issue" notification
// to every enrolled student. Fire-and-forget fan-out; responds immediately.
router.post('/announcements/known-bug', fetchLoggedInUser, requireAdmin, v(knownBugSchema), async function (req, res) {
  const bugDescription = req.body.bugDescription.trim()
  // Fire-and-forget per notificationEvents.js contract — must NOT await.
  notificationEvents.notifyKnownBug(bugDescription)
  res.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Account-expiry reminder setting
// ─────────────────────────────────────────────────────────────────────────────

// GET /announcements/account-expiry-setting — current threshold (days before expiry)
router.get('/announcements/account-expiry-setting', fetchLoggedInUser, requireAdmin, async function (req, res) {
  const days = await svc.getAccountExpiryNoticeDays()
  res.json({ success: true, days })
})

const accountExpirySettingSchema = {
  body: Joi.object({
    days: Joi.number().integer().min(1).max(365).required(),
  }),
}

// PUT /announcements/account-expiry-setting — update threshold (days before expiry)
router.put(
  '/announcements/account-expiry-setting',
  fetchLoggedInUser,
  requireAdmin,
  v(accountExpirySettingSchema),
  async function (req, res) {
    await svc.setAccountExpiryNoticeDays(req.body.days)
    res.json({ success: true, days: req.body.days })
  }
)

module.exports = router
