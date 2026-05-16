const _ = require('lodash')
const crypto = require('crypto')
const logger = require('../util/logger')
const { USER_AREA } = require('../util/constants')
const StatisticService = require('./services/statistic.service')
const { getMineCohortArea } = require('./api_util/api_util')
const { tryAcquire, release } = require('../util/backgroundLock')

const { UserStatsCache, Sequelize, sequelize } = require('../db/models')

const { Op } = Sequelize

// ---------- lightweight in-memory LRU (no extra dependency) ----------
//
// Backed by a Map which preserves insertion order, so eviction is O(1).
// get() refreshes position; entries expire after ttlMs.
// Conservative defaults: 500 entries max, 5-minute TTL.
//
const STATS_LRU_MAX = Number(process.env.STATS_LRU_MAX) || 500
const STATS_LRU_TTL_MS = Number(process.env.STATS_LRU_TTL_MS) || 5 * 60 * 1000

class StatsLRU {
  constructor({ max = STATS_LRU_MAX, ttlMs = STATS_LRU_TTL_MS } = {}) {
    this._map = new Map()
    this._max = max
    this._ttlMs = ttlMs
  }

  _key(userId, cacheType, challenge) {
    return `${userId}:${cacheType}:${challenge}`
  }

  get(userId, cacheType, challenge) {
    const k = this._key(userId, cacheType, challenge)
    const entry = this._map.get(k)
    if (!entry) return undefined
    if (Date.now() - entry.ts > this._ttlMs) {
      this._map.delete(k)
      return undefined
    }
    // Refresh position (move to end = most recently used)
    this._map.delete(k)
    this._map.set(k, entry)
    return entry.data
  }

  set(userId, cacheType, challenge, data) {
    const k = this._key(userId, cacheType, challenge)
    this._map.delete(k)
    this._map.set(k, { data, ts: Date.now() })
    while (this._map.size > this._max) {
      const oldest = this._map.keys().next().value
      this._map.delete(oldest)
    }
  }

  deleteUser(userId) {
    const prefix = `${userId}:`
    for (const k of [...this._map.keys()]) {
      if (k.startsWith(prefix)) this._map.delete(k)
    }
  }

  clear() {
    this._map.clear()
  }

  get size() {
    return this._map.size
  }
}

const _statsLru = new StatsLRU()

// ---------- internal builders ----------
//
// These build the full payloads exactly like the /statistics
// and /statistics/tests/whom endpoints expect, for ONE user.
//

async function buildStatisticsForUser(userId, includeChallengeMode, transaction = null) {
  const where = { id: userId }

  // same filter logic as /statistics used
  const challengeModeFilter = includeChallengeMode
    ? {}
    : {
        isChallengeMode: {
          [Op.or]: [false, null],
        },
      }

  const cohortArea = await getMineCohortArea(userId)
  const dataSql = StatisticService.getStatisticSql(where, challengeModeFilter, undefined, { region: cohortArea })

  let data = await sequelize.query(dataSql, {
    type: sequelize.QueryTypes.SELECT,
    transaction,
  })

  // get all qsr ids by region to pull comment flags
  const allQuestionSetResultsIdUSEasts = data
    .filter((el) => el.cohortArea == USER_AREA.US_EAST)
    .map((el) => el.questionSetResultId)

  const allQuestionSetResultsIdEUWests = data
    .filter((el) => el.cohortArea == USER_AREA.EU_WEST)
    .map((el) => el.questionSetResultId)

  // Run both region queries in parallel to halve comment-flag latency
  const [flagsUSEastMap, flagsEUWestMap] = await Promise.all([
    StatisticService.getCommentFlagsUSEast(allQuestionSetResultsIdUSEasts, transaction),
    StatisticService.getCommentFlagsEUWest(allQuestionSetResultsIdEUWests, transaction),
  ])

  // decorate rows with the booleans the frontend expects
  data = data.map((el) => {
    const flagRec =
      el.cohortArea == USER_AREA.EU_WEST
        ? flagsEUWestMap[el.questionSetResultId] || {}
        : flagsUSEastMap[el.questionSetResultId] || {}

    const hasAdminComment = !!flagRec.hasAdminComment
    const hasUnseenAdminComment = !!flagRec.hasUnseenAdminComment
    const hasUserReply = !!flagRec.hasUserReply
    const hasUnseenUserReply = !!flagRec.hasUnseenUserReply

    return {
      ...el,
      isViewedAdminComment: !hasUnseenAdminComment,
      isViewedUserReply: !hasUnseenUserReply,
      isHasComment: hasAdminComment,
      isHasReply: hasUserReply,
    }
  })

  return data
}

// Build the /statistics/tests/whom-style rows for ONE user
async function buildTestsForUser(userId, includeChallengeMode, transaction = null) {
  const where = { id: userId }

  // same filter logic as /statistics/tests/whom used
  const questionSetResultsWhere = includeChallengeMode
    ? {}
    : {
        isChallengeMode: {
          [Op.or]: [false, null],
        },
      }

  // this already returns decorated rows (bodyPart "Without", comment flags, etc.)
  const whomTag = `user_${userId}`
  const data = await StatisticService.getTestRunAndGroupStackQuestionResultForOneUser(
    where,
    questionSetResultsWhere,
    whomTag,
    transaction,
  )

  return data
}

// ---------- low-level cache ops ----------

async function touchLastUsed(row, transaction = null) {
  row.lastUsed = new Date()
  await row.save({ fields: ['lastUsed'], transaction })
}

// Batch-touch lastUsed for many rows in a single UPDATE
async function batchTouchLastUsed(rowIds) {
  if (!rowIds.length) return
  await UserStatsCache.update({ lastUsed: new Date() }, { where: { id: { [Op.in]: rowIds } } })
}

async function upsertCache(userId, cacheType, includeChallengeMode, dataArr, transaction = null) {
  const now = new Date()

  const [row, created] = await UserStatsCache.findOrCreate({
    where: { userId, cacheType, includeChallengeMode },
    defaults: {
      data: dataArr,
      lastUpdatedAt: now,
      lastUsed: now,
    },
    transaction,
  })

  if (!created) {
    row.data = dataArr
    row.lastUpdatedAt = now // <= update timestamp to NOW (not null)
    row.lastUsed = now
    await row.save({ fields: ['data', 'lastUpdatedAt', 'lastUsed'], transaction })
  }

  // Keep in-memory LRU in sync so subsequent reads skip the DB entirely
  _statsLru.set(userId, cacheType, includeChallengeMode, dataArr)

  return row
}

// Compute fresh + write to DB for /statistics
async function recalcUserStatistics(userId, includeChallengeMode, transaction = null) {
  const freshData = await buildStatisticsForUser(userId, includeChallengeMode, transaction)
  const row = await upsertCache(userId, 'statistics', includeChallengeMode, freshData, transaction)
  return row.data || []
}

// Compute fresh + write to DB for /statistics/tests/whom
async function recalcUserTests(userId, includeChallengeMode, transaction = null) {
  const freshData = await buildTestsForUser(userId, includeChallengeMode, transaction)
  const row = await upsertCache(userId, 'tests_whom', includeChallengeMode, freshData, transaction)
  return row.data || []
}

// Main read path for /statistics
// - If cache row exists, just return row.data (we already keep it fresh on submit)
// - If missing, compute & upsert.
async function getOrRecalcUserStatistics(userId, includeChallengeMode) {
  // Fast path: in-memory LRU hit — no DB call at all
  const lruHit = _statsLru.get(userId, 'statistics', includeChallengeMode)
  if (lruHit !== undefined) return lruHit

  // DB fallback (LRU miss or expired)
  let row = await UserStatsCache.findOne({
    where: { userId, cacheType: 'statistics', includeChallengeMode },
  })

  if (row) {
    const data = row.data || []
    _statsLru.set(userId, 'statistics', includeChallengeMode, data)

    // fire-and-forget — don't block the response on a lastUsed UPDATE
    touchLastUsed(row).catch((err) => logger.warn('[statsCacheHelper] touchLastUsed failed', err))

    return data
  }

  // cold start — recalc populates LRU via upsertCache
  return recalcUserStatistics(userId, includeChallengeMode)
}

// Same but for /statistics/tests/whom
async function getOrRecalcUserTests(userId, includeChallengeMode) {
  // Fast path: in-memory LRU hit — no DB call at all
  const lruHit = _statsLru.get(userId, 'tests_whom', includeChallengeMode)
  if (lruHit !== undefined) return lruHit

  // DB fallback (LRU miss or expired)
  let row = await UserStatsCache.findOne({
    where: { userId, cacheType: 'tests_whom', includeChallengeMode },
  })

  if (row) {
    const data = row.data || []
    _statsLru.set(userId, 'tests_whom', includeChallengeMode, data)

    // fire-and-forget — don't block the response on a lastUsed UPDATE
    touchLastUsed(row).catch((err) => logger.warn('[statsCacheHelper] touchLastUsed failed', err))

    return data
  }

  // cold start — recalc populates LRU via upsertCache
  return recalcUserTests(userId, includeChallengeMode)
}

// ---------- NEW: refresh cache immediately after submission ----------

// --------- BATCH RETRIEVAL for /statistics and /statistics/tests/whom ---------
//
// Instead of N serial findOne + touchLastUsed calls, fetch ALL rows in 1 query,
// touch lastUsed in 1 UPDATE, then only recalc cold-start users concurrently.
//

const COLD_START_CONCURRENCY = 10
async function batchGetOrRecalcUserStatistics(userIds, includeChallengeMode) {
  if (!userIds.length) return {}

  // 1. Bulk fetch all existing cache rows
  const rows = await UserStatsCache.findAll({
    where: {
      userId: { [Op.in]: userIds },
      cacheType: 'statistics',
      includeChallengeMode,
    },
  })

  const rowMap = {}
  const touchIds = []
  for (const row of rows) {
    const data = row.data || []
    rowMap[row.userId] = data
    _statsLru.set(row.userId, 'statistics', includeChallengeMode, data)
    touchIds.push(row.id)
  }

  // 2. Batch touch lastUsed in 1 UPDATE
  batchTouchLastUsed(touchIds).catch((err) => logger.warn('[statsCacheHelper] batchTouchLastUsed failed', err))

  // 3. Find cold-start users (no cache row)
  const coldUserIds = userIds.filter((uid) => !(uid in rowMap))

  // 4. Recalc cold-start users with controlled concurrency
  if (coldUserIds.length > 0) {
    for (let i = 0; i < coldUserIds.length; i += COLD_START_CONCURRENCY) {
      const batch = coldUserIds.slice(i, i + COLD_START_CONCURRENCY)
      const results = await Promise.all(
        batch.map((uid) =>
          recalcUserStatistics(uid, includeChallengeMode).catch((err) => {
            logger.warn(`[statsCacheHelper] cold start recalc failed for user ${uid}`, err)
            return []
          }),
        ),
      )
      batch.forEach((uid, idx) => {
        rowMap[uid] = results[idx]
      })
    }
  }

  return rowMap
}

async function batchGetOrRecalcUserTests(userIds, includeChallengeMode) {
  if (!userIds.length) return {}

  // 1. Bulk fetch all existing cache rows
  const rows = await UserStatsCache.findAll({
    where: {
      userId: { [Op.in]: userIds },
      cacheType: 'tests_whom',
      includeChallengeMode,
    },
  })

  const rowMap = {}
  const touchIds = []
  for (const row of rows) {
    const data = row.data || []
    rowMap[row.userId] = data
    _statsLru.set(row.userId, 'tests_whom', includeChallengeMode, data)
    touchIds.push(row.id)
  }

  // 2. Batch touch lastUsed in 1 UPDATE
  batchTouchLastUsed(touchIds).catch((err) => logger.warn('[statsCacheHelper] batchTouchLastUsed failed', err))

  // 3. Find cold-start users (no cache row)
  const coldUserIds = userIds.filter((uid) => !(uid in rowMap))

  // 4. Recalc cold-start users with controlled concurrency
  if (coldUserIds.length > 0) {
    for (let i = 0; i < coldUserIds.length; i += COLD_START_CONCURRENCY) {
      const batch = coldUserIds.slice(i, i + COLD_START_CONCURRENCY)
      const results = await Promise.all(
        batch.map((uid) =>
          recalcUserTests(uid, includeChallengeMode).catch((err) => {
            logger.warn(`[statsCacheHelper] cold start recalc tests failed for user ${uid}`, err)
            return []
          }),
        ),
      )
      batch.forEach((uid, idx) => {
        rowMap[uid] = results[idx]
      })
    }
  }

  return rowMap
}

// ---------- cohort-level cache pre-warming ----------
//
// When a cohort dashboard is opened and cold-start users exist, this fires
// in the background to pre-build caches for ALL users in the cohort so the
// *next* page load (or live-reload) is instant.
//
// An in-memory set prevents duplicate warm jobs for the same cohort.

const _warmingCohorts = new Set()
const WARM_CONCURRENCY = 4 // Reduced from 8 to prevent memory spikes

async function warmCohortCachesInBackground(cohortUserIds, includeChallengeMode) {
  // Build a stable key using MD5 hash to avoid huge string keys in Set
  const hash = crypto.createHash('md5')
  hash.update(cohortUserIds.sort((a, b) => a - b).join(','))
  hash.update(`_${includeChallengeMode}`)
  const key = hash.digest('hex')

  if (_warmingCohorts.has(key)) return
  _warmingCohorts.add(key)

  // Fire-and-forget — skip if a heavy background task is already running
  ;(async () => {
    if (!tryAcquire('warmCohortCaches')) {
      _warmingCohorts.delete(key)
      return
    }
    try {
      // Figure out which users already have cache rows
      const existingRows = await UserStatsCache.findAll({
        attributes: ['userId', 'cacheType'],
        where: {
          userId: { [Op.in]: cohortUserIds },
          includeChallengeMode,
          cacheType: { [Op.in]: ['statistics', 'tests_whom'] },
        },
      })

      const hasStats = new Set()
      const hasTests = new Set()
      for (const r of existingRows) {
        if (r.cacheType === 'statistics') hasStats.add(r.userId)
        if (r.cacheType === 'tests_whom') hasTests.add(r.userId)
      }

      // Collect users missing either cache type
      const needsWork = cohortUserIds.filter((uid) => !hasStats.has(uid) || !hasTests.has(uid))

      if (!needsWork.length) return

      logger.info(
        `[statsCacheHelper] Background-warming ${needsWork.length} cold users ` +
          `(challengeMode=${includeChallengeMode})`,
      )

      for (let i = 0; i < needsWork.length; i += WARM_CONCURRENCY) {
        const batch = needsWork.slice(i, i + WARM_CONCURRENCY)
        await Promise.all(
          batch.map(async (uid) => {
            try {
              if (!hasStats.has(uid)) await recalcUserStatistics(uid, includeChallengeMode)
              if (!hasTests.has(uid)) await recalcUserTests(uid, includeChallengeMode)
            } catch (err) {
              logger.warn(`[statsCacheHelper] background warm failed for user ${uid}`, err)
            }
          }),
        )
      }

      logger.info(`[statsCacheHelper] Background warm complete for ${needsWork.length} users`)
    } catch (err) {
      logger.error('[statsCacheHelper] warmCohortCachesInBackground error', err)
    } finally {
      release('warmCohortCaches')
      _warmingCohorts.delete(key)
    }
  })()
}

// ---------- refresh cache immediately after submission ----------
//
// Instead of "mark dirty", we now eagerly rebuild AND upsert both cache rows
// at submit time, inside the same transaction so we see the just-inserted data.
// Also note: lastUpdatedAt is set to NOW in upsertCache().
//
async function flagCachesDirtyAfterSubmission(userId, isChallengeMode, transaction = null) {
  // If this submission was NOT challenge mode, we also need to refresh
  // the non-challenge caches.
  if (String(isChallengeMode).toLowerCase() === 'false') {
    await Promise.all([recalcUserStatistics(userId, false, transaction), recalcUserTests(userId, false, transaction)])
  }

  // Always refresh challengeMode=true cache
  await Promise.all([recalcUserStatistics(userId, true, transaction), recalcUserTests(userId, true, transaction)])
}

// Refresh caches after comment create/update/view operations
// Always refreshes both challenge mode variants since comments affect all results
async function refreshCachesAfterCommentChange(studentUserId, transaction = null) {
  // Run all four cache rebuilds in parallel — none depend on each other
  await Promise.all([
    recalcUserStatistics(studentUserId, false, transaction),
    recalcUserTests(studentUserId, false, transaction),
    recalcUserStatistics(studentUserId, true, transaction),
    recalcUserTests(studentUserId, true, transaction),
  ])
}

// Destroy all cached rows for a user so the next read triggers a cold-start rebuild.
// This is intentionally fast (single DELETE) and should be awaited before responding
// to the client, so a subsequent fetch never reads stale data.
async function invalidateCachesForUser(userId) {
  _statsLru.deleteUser(userId)
  await UserStatsCache.destroy({
    where: { userId },
  })
}

module.exports = {
  getOrRecalcUserStatistics,
  getOrRecalcUserTests,
  batchGetOrRecalcUserStatistics,
  batchGetOrRecalcUserTests,
  recalcUserStatistics,
  recalcUserTests,
  flagCachesDirtyAfterSubmission,
  refreshCachesAfterCommentChange,
  invalidateCachesForUser,
  warmCohortCachesInBackground,
  _statsLru,
}
