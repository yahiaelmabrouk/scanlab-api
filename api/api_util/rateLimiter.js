const logger = require('../../util/logger')

// In-memory sliding window rate limiter.
// Map<apiKeyId, number[]> -- each entry is a list of request timestamps (ms).
const _windows = new Map()

// Prune stale entries periodically to prevent unbounded memory growth.
// Keys are removed only when their window array becomes empty after pruning.
setInterval(() => {
  const now = Date.now()
  for (const [id, timestamps] of _windows) {
    // Keep only entries that could still be within a plausible window.
    // We use a 1-hour ceiling; keys with no recent traffic are deleted.
    const cutoff = now - 3600 * 1000
    const pruned = timestamps.filter((t) => t > cutoff)
    if (pruned.length === 0) {
      _windows.delete(id)
    } else {
      _windows.set(id, pruned)
    }
  }
}, 60 * 1000).unref() // unref so this timer does not keep the process alive

function checkRateLimit(req, res, next) {
  // Only apply rate limiting to API key authenticated requests
  if (!req.session || !req.session.apiKey) return next()

  const apiKeyId = req.session.apiKey.id

  try {
    const limit = Number(req.session.apiKey.rateLimit || 0)
    const windowSec = Number(req.session.apiKey.rateLimitWindow || 1)

    // Skip rate limiting when no limit is configured
    if (!limit) return next()

    const now = Date.now()
    const windowMs = windowSec * 1000
    const cutoff = now - windowMs

    // Retrieve or initialise the timestamp list for this key
    let timestamps = _windows.get(apiKeyId)
    if (!timestamps) {
      timestamps = []
      _windows.set(apiKeyId, timestamps)
    }

    // Sliding window: drop timestamps that have fallen outside the window.
    // Timestamps are appended in order, so we binary-search for the cutoff.
    let lo = 0
    let hi = timestamps.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (timestamps[mid] <= cutoff) lo = mid + 1
      else hi = mid
    }
    // lo is the index of the first timestamp still inside the window
    if (lo > 0) timestamps.splice(0, lo)

    // Record the current request
    timestamps.push(now)

    const count = timestamps.length

    // Best-effort rate-limit headers
    res.set({
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - count)),
      'X-RateLimit-Window': String(windowSec),
    })

    if (count > limit) {
      logger.warn(`Rate limit exceeded for API key ${req.session.apiKey.name} (${count}/${limit})`)
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${limit} requests per ${windowSec} seconds`,
      })
    }

    next()
  } catch (error) {
    logger.error('Rate limit check failed:', error)
    next() // don't block on limiter errors
  }
}

module.exports = { checkRateLimit }
