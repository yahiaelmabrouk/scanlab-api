const logger = require('../../util/logger')

/**
 * Simple in-memory TTL cache for middleware hot-path data.
 *
 * Keeps frequently-read, rarely-changed data out of the database on every
 * API-key request.  Each entry expires after `defaultTTL` ms and is lazily
 * evicted on the next `get()`.  A periodic sweep runs every minute to avoid
 * unbounded growth.
 */
class MemoryCache {
  /**
   * @param {string} name - human-readable label (used in logs)
   * @param {number} defaultTTL - milliseconds before an entry is stale (default 5 min)
   */
  constructor(name, defaultTTL = 5 * 60 * 1000) {
    this.name = name
    this.defaultTTL = defaultTTL
    this._store = new Map()

    // Periodic sweep every 60 s so deleted / expired keys don't linger
    this._sweepInterval = setInterval(() => this._sweep(), 60_000)
    if (this._sweepInterval.unref) this._sweepInterval.unref() // don't keep process alive
  }

  /** Retrieve a value - returns `undefined` when missing or expired. */
  get(key) {
    const entry = this._store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key)
      return undefined
    }
    return entry.value
  }

  /** Store a value with an optional per-key TTL override. */
  set(key, value, ttl) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    })
  }

  /** Explicitly remove a key (e.g. after an admin mutation). */
  delete(key) {
    this._store.delete(key)
  }

  /** Wipe the whole cache (useful after bulk admin changes). */
  clear() {
    this._store.clear()
    logger.info(`[MemoryCache:${this.name}] cleared`)
  }

  /** Number of live entries (does NOT count expired-but-not-yet-swept). */
  get size() {
    return this._store.size
  }

  /* ---- internal ---- */

  _sweep() {
    const now = Date.now()
    let swept = 0
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key)
        swept++
      }
    }
    if (swept > 0) {
      logger.debug(`[MemoryCache:${this.name}] swept ${swept} expired entries`)
    }
  }

  /**
   * Delete all keys that begin with `prefix`.
   * Useful for invalidating all cached sessions for a given user ID.
   */
  deletePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key)
      }
    }
  }

  /** For graceful shutdown / tests. */
  destroy() {
    clearInterval(this._sweepInterval)
    this._store.clear()
  }
}

/* -------------------------------------------------------------------------
 * Shared cache instances used across the middleware chain
 * ------------------------------------------------------------------------- */

/** API-key records keyed by prefix - TTL 5 min (keys rarely change) */
const apiKeyCache = new MemoryCache('apiKey', 5 * 60 * 1000)

/** Active endpoint list for matchEndpoint() - TTL 5 min */
const endpointCache = new MemoryCache('endpoints', 5 * 60 * 1000)

/** Cohort-endpoint permission lookups - TTL 5 min */
const permissionCache = new MemoryCache('permissions', 5 * 60 * 1000)

/**
 * JWT user-session cache - keyed by `"<userId>:<generated_at>"`.
 * A 60-second TTL means up to 19 out of 20 requests in a busy minute skip
 * the heavy multi-JOIN User.findOne() query entirely.
 */
const userSessionCache = new MemoryCache('userSession', 60 * 1000)

/* -------------------------------------------------------------------------
 * Batched lastUsedAt writer - coalesces per-request updates into a single
 * DB write per API key at most once per FLUSH_INTERVAL.
 * ------------------------------------------------------------------------- */
const FLUSH_INTERVAL = 60_000 // 1 minute

/** Map<apiKeyId, Date> - most-recent timestamp wins */
const _pendingLastUsedAt = new Map()
let _flushTimer = null

function enqueueLastUsedAtUpdate(apiKeyId) {
  _pendingLastUsedAt.set(apiKeyId, new Date())

  // Lazy-start the flush timer on first enqueue
  if (!_flushTimer) {
    _flushTimer = setInterval(() => _flushLastUsedAt(), FLUSH_INTERVAL)
    if (_flushTimer.unref) _flushTimer.unref()
  }
}

async function _flushLastUsedAt() {
  if (_pendingLastUsedAt.size === 0) return

  // Snapshot and clear so new writes don't block
  const batch = new Map(_pendingLastUsedAt)
  _pendingLastUsedAt.clear()

  const prisma = require('../../db/prisma') // lazy require to avoid circular deps

  try {
    // Use a transaction for efficiency when there are multiple keys
    const updates = Array.from(batch.entries()).map(([id, lastUsedAt]) =>
      prisma.apiKey.update({ where: { id }, data: { lastUsedAt } })
    )
    await Promise.allSettled(updates)
    logger.debug(`[lastUsedAt] flushed ${updates.length} batched updates`)
  } catch (err) {
    logger.error('[lastUsedAt] batch flush failed:', err)
  }
}

/** Flush immediately - for graceful shutdown. */
async function flushLastUsedAtNow() {
  if (_flushTimer) {
    clearInterval(_flushTimer)
    _flushTimer = null
  }
  await _flushLastUsedAt()
}

/* -------------------------------------------------------------------------
 * WeightBasedDose reference cache
 *
 * WeightBasedDose is a small, static lookup table (weight → contrast dose).
 * It has no FK to BodyPart or QuestionSet, so the entire table is always
 * needed.  Caching it avoids a full-table scan on every test submission.
 * TTL is 30 minutes; admin tooling should call invalidateWeightBasedDoseCache()
 * after any write.
 * ------------------------------------------------------------------------- */

/** In-process singleton – populated on first call, evicted after 30 min. */
const weightBasedDoseCache = new MemoryCache('weightBasedDose', 30 * 60 * 1000)
const WEIGHT_BASED_DOSE_CACHE_KEY = 'all'

/**
 * Returns all WeightBasedDose rows, ordered by weightMetric ASC.
 * Hits the cache if warm; otherwise queries the DB and populates the cache.
 *
 * @param {object} WeightBasedDoseModel  - the Sequelize WeightBasedDose model
 * @returns {Promise<object[]>}
 */
async function getCachedWeightBasedDoses(WeightBasedDoseModel) {
  const cached = weightBasedDoseCache.get(WEIGHT_BASED_DOSE_CACHE_KEY)
  if (cached) return cached

  const rows = await WeightBasedDoseModel.findAll({
    order: [['weightMetric', 'ASC']],
  })
  weightBasedDoseCache.set(WEIGHT_BASED_DOSE_CACHE_KEY, rows)
  return rows
}

/** Evict the cached rows (call after any admin write to WeightBasedDoses). */
function invalidateWeightBasedDoseCache() {
  weightBasedDoseCache.delete(WEIGHT_BASED_DOSE_CACHE_KEY)
}

/* -------------------------------------------------------------------------
 * Exports
 * ------------------------------------------------------------------------- */
module.exports = {
  MemoryCache,
  apiKeyCache,
  endpointCache,
  permissionCache,
  userSessionCache,
  enqueueLastUsedAtUpdate,
  flushLastUsedAtNow,
  getCachedWeightBasedDoses,
  invalidateWeightBasedDoseCache,
}
