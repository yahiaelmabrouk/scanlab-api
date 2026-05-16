const prisma = require('../../db/prisma')
const { sendMail } = require('../../util/email')
const { sendSms } = require('../../util/sms')
const logger = require('../../util/logger')

const DEFAULT_ENABLED_CHANNELS = new Set(['in_app', 'email'])

// ─────────────────────────────────────────────────────────────────────────────
// Internal dispatch helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getUserPreferences(userId) {
  return prisma.notificationPreference.findMany({ where: { userId } })
}

function buildPreferenceMap(preferences) {
  const map = {}
  for (const pref of preferences) {
    map[`${pref.channel}:${pref.eventType}`] = pref.enabled
  }
  return map
}

function isChannelEnabled(prefMap, channel, eventType) {
  const key = `${channel}:${eventType}`
  if (key in prefMap) return prefMap[key]
  return DEFAULT_ENABLED_CHANNELS.has(channel)
}

async function dispatchInApp(prismaClient, userId, eventType, context) {
  const { title, message, deepLink } = context
  await prismaClient.notification.create({
    data: {
      userId,
      type: eventType,
      title: title || eventType,
      message: message || '',
      deepLink: deepLink || null,
    },
  })
}

async function dispatchEmail(prismaClient, userId, eventType, context) {
  const { title, message, deepLink, emailSubject, emailHtml, emailText } = context

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  })
  if (!user?.email) return

  if (!user.emailVerified) {
    logger.info(`[notification] skipping email for user ${userId} (${eventType}) — email not verified`)
    return
  }

  const linkHtml = deepLink ? `<p><a href="${deepLink}">View in ScanLab</a></p>` : ''
  await sendMail({
    to: user.email,
    subject: emailSubject || title || eventType,
    html: emailHtml || `<p>${message || ''}</p>${linkHtml}`,
    text: emailText || message || '',
  })
}

async function dispatchSms(prismaClient, userId, eventType, context) {
  const { title, message, deepLink } = context
  const phone = await prismaClient.userPhone.findUnique({
    where: { userId },
    select: { phoneNumber: true, verified: true },
  })
  if (!phone?.phoneNumber || !phone.verified) return

  const parts = []
  if (title) parts.push(title)
  if (message) parts.push(message)
  if (deepLink) parts.push(deepLink)
  await sendSms(phone.phoneNumber, parts.join(': '))
}

// ─────────────────────────────────────────────────────────────────────────────
// Core dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify a user across all enabled channels independently.
 *
 * @param {number} userId
 * @param {string} eventType   - NotificationType enum value, e.g. 'EXAM_ASSIGNED'
 * @param {object} context
 *   title        - short heading (in-app title / email subject fallback)
 *   message      - body text
 *   deepLink     - optional URL to relevant content
 *   emailSubject - overrides title as email subject
 *   emailHtml    - overrides auto-generated HTML body (use emailTemplates.js)
 *   emailText    - plain-text email fallback
 */
async function notifyUser(userId, eventType, context = {}) {
  let preferences
  try {
    preferences = await getUserPreferences(userId)
  } catch (err) {
    logger.error(`[notification] failed to fetch preferences for user ${userId}: ${err.message}`)
    preferences = [] // fall back to DEFAULT_ENABLED_CHANNELS rather than aborting
  }

  const prefMap = buildPreferenceMap(preferences)

  const dispatchers = [
    { channel: 'in_app', fn: dispatchInApp },
    { channel: 'email', fn: dispatchEmail },
    { channel: 'sms', fn: dispatchSms },
  ]

  await Promise.allSettled(
    dispatchers
      .filter(({ channel }) => isChannelEnabled(prefMap, channel, eventType))
      .map(({ channel, fn }) =>
        fn(prisma, userId, eventType, context).catch((err) =>
          logger.error(`[notification] ${channel} failed for user ${userId} (${eventType}): ${err.message}`)
        )
      )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification CRUD (for API routes)
// ─────────────────────────────────────────────────────────────────────────────

async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ])
  return { notifications, total, page, limit, pages: Math.ceil(total / limit) }
}

async function markOneRead(id, userId) {
  // Scope lookup to userId so users cannot mark each other's notifications
  const notification = await prisma.notification.findFirst({ where: { id, userId } })
  if (!notification) {
    const err = new Error('Notification not found')
    err.status = 404
    throw err
  }
  return prisma.notification.update({ where: { id }, data: { isRead: true } })
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

async function getUnreadCount(userId) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } })
  return { count }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification preferences CRUD
// ─────────────────────────────────────────────────────────────────────────────

async function getPreferences(userId) {
  return prisma.notificationPreference.findMany({ where: { userId } })
}

async function upsertPreferences(userId, preferences) {
  return Promise.all(
    preferences.map(({ eventType, channel, enabled }) =>
      prisma.notificationPreference.upsert({
        where: { userId_channel_eventType: { userId, channel, eventType } },
        create: { userId, channel, eventType, enabled },
        update: { enabled },
      })
    )
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone
// ─────────────────────────────────────────────────────────────────────────────

async function getPhoneStatus(userId) {
  const phone = await prisma.userPhone.findUnique({
    where: { userId },
    select: { phoneNumber: true, countryCode: true, verified: true },
  })
  if (!phone) return { phoneNumber: null, countryCode: null, verified: false }
  return { phoneNumber: phone.phoneNumber, countryCode: phone.countryCode, verified: phone.verified }
}

async function setPhoneDirect(userId, phoneNumber, countryCode) {
  await prisma.userPhone.upsert({
    where: { userId },
    create: { userId, phoneNumber, countryCode, verified: true, verifiedAt: new Date() },
    update: { phoneNumber, countryCode, verified: true, verifiedAt: new Date() },
  })
}

module.exports = {
  notifyUser,
  getNotifications,
  markOneRead,
  markAllRead,
  getUnreadCount,
  getPreferences,
  upsertPreferences,
  getPhoneStatus,
  setPhoneDirect,
}
