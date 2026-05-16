const logger = require('../util/logger')
const prisma = require('../db/prisma')
const CACHE_REFRESH_INTERVAL_MINUTES = process.env.CACHE_REFRESH_INTERVAL_MINUTES || 120

let inMemoryCache = {}
let isCacheLoaded = false
let _refreshTimer = null

async function refreshInMemoryCache() {
  try {
    const all = await prisma.cohortAverageCache.findMany()
    inMemoryCache = {}
    all.forEach((row) => {
      inMemoryCache[row.cohortId] = row
    })
    isCacheLoaded = true
  } catch (error) {
    logger.error('[CacheHelper] refreshInMemoryCache failed', error)
  } finally {
    const intervalMs = CACHE_REFRESH_INTERVAL_MINUTES * 60 * 1000
    _refreshTimer = setTimeout(() => {
      refreshInMemoryCache().catch((err) => logger.error('[CacheHelper] refreshInMemoryCache loop failed', err))
    }, intervalMs)
  }
}

function stopRefreshTimer() {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer)
    _refreshTimer = null
  }
}

// ---- Batched lastUsed updates ----
// Instead of a fire-and-forget Prisma write per getCohortCache() call,
// collect cohort IDs and flush once every 30 seconds.
const _pendingLastUsed = new Map()
let _lastUsedFlushTimer = null
const LAST_USED_FLUSH_INTERVAL = 30_000

function _enqueueLastUsedUpdate(cohortId) {
  _pendingLastUsed.set(cohortId, new Date())
  if (!_lastUsedFlushTimer) {
    _lastUsedFlushTimer = setTimeout(_flushLastUsed, LAST_USED_FLUSH_INTERVAL)
  }
}

async function _flushLastUsed() {
  _lastUsedFlushTimer = null
  if (_pendingLastUsed.size === 0) return
  const batch = new Map(_pendingLastUsed)
  _pendingLastUsed.clear()
  try {
    const updates = Array.from(batch.entries()).map(([cohortId, lastUsed]) =>
      prisma.cohortAverageCache.update({
        where: { cohortId: Number(cohortId) },
        data: { lastUsed },
      })
    )
    await Promise.allSettled(updates)
  } catch (err) {
    logger.error('[CacheHelper] batchLastUsed flush failed', err)
  }
}

async function flushLastUsedNow() {
  if (_lastUsedFlushTimer) {
    clearTimeout(_lastUsedFlushTimer)
    _lastUsedFlushTimer = null
  }
  await _flushLastUsed()
}

async function getCohortCache(cohortId) {
  const numericId = Number(cohortId)

  // Fast path: return from in-memory cache if available (avoids DB read)
  if (isCacheLoaded && inMemoryCache[numericId]) {
    _enqueueLastUsedUpdate(numericId)
    return inMemoryCache[numericId]
  }

  // Fallback: DB read (cold start or cache not loaded yet)
  const cache = await prisma.cohortAverageCache.findUnique({
    where: { cohortId: numericId },
  })
  if (cache) {
    inMemoryCache[numericId] = cache
    _enqueueLastUsedUpdate(numericId)
  }
  return cache
}

async function updateCohortCache(cohortId, angleAvg, wastedSlicesAvg, wastedCoverageAvg) {
  const now = new Date()
  const updated = await prisma.cohortAverageCache.upsert({
    where: { cohortId: Number(cohortId) },
    update: {
      angleAverage: angleAvg,
      wastedSlicesAverage: wastedSlicesAvg,
      wastedCoverageAverage: wastedCoverageAvg,
      lastUpdatedAt: now,
      lastUsed: now,
    },
    create: {
      cohortId: Number(cohortId),
      angleAverage: angleAvg,
      wastedSlicesAverage: wastedSlicesAvg,
      wastedCoverageAverage: wastedCoverageAvg,
      lastUpdatedAt: now,
      lastUsed: now,
    },
  })
  inMemoryCache[Number(cohortId)] = updated
}

function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false
  const now = new Date()
  const diff = (now - new Date(lastUpdated)) / (1000 * 60)
  return diff < CACHE_REFRESH_INTERVAL_MINUTES
}

refreshInMemoryCache()

module.exports = {
  isCacheFresh,
  getCohortCache,
  updateCohortCache,
  CACHE_REFRESH_INTERVAL_MINUTES,
  refreshInMemoryCache,
  stopRefreshTimer,
  flushLastUsedNow,
  isCacheLoaded,
  inMemoryCache,
}
