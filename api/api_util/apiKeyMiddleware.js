const _ = require('lodash')
const logger = require('../../util/logger')
const { validateApiKey, extractPrefixFromKey } = require('./apiKey')
const prisma = require('../../db/prisma')
const { apiKeyCache, enqueueLastUsedAtUpdate } = require('./middlewareCache')

async function validateApiKeyMiddleware(req, res, next) {
  if (_.isString(req.headers['x-api-key'])) {
    const apiKey = req.headers['x-api-key']

    try {
      const prefix = extractPrefixFromKey(apiKey)
      if (!prefix) {
        logger.info('Invalid API key format')
        return res.status(401).json({ success: false, error: 'Invalid API key format' })
      }

      // --- PERF: check in-memory cache before hitting DB ---
      let apiKeyRecord = apiKeyCache.get(`prefix:${prefix}`)

      if (!apiKeyRecord) {
        apiKeyRecord = await prisma.apiKey.findFirst({
          where: {
            keyPrefix: prefix,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: {
            Cohort: true,
          },
        })

        if (apiKeyRecord) {
          // Cache for 5 minutes (default TTL)
          apiKeyCache.set(`prefix:${prefix}`, apiKeyRecord)
        }
      }

      if (!apiKeyRecord) {
        logger.info('API key not found or expired')
        return res.status(401).json({ success: false, error: 'Invalid or expired API key' })
      }

      // Check expiry on cached records (they may have expired since caching)
      if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) <= new Date()) {
        apiKeyCache.delete(`prefix:${prefix}`)
        logger.info('API key expired (detected from cache)')
        return res.status(401).json({ success: false, error: 'Invalid or expired API key' })
      }

      const isValid = await validateApiKey(apiKey, apiKeyRecord.keyHash)
      if (!isValid) {
        logger.info('API key validation failed')
        return res.status(401).json({ success: false, error: 'Invalid API key' })
      }

      // --- PERF: batch lastUsedAt writes (once per minute, not per request) ---
      enqueueLastUsedAtUpdate(apiKeyRecord.id)

      // Also stash rate-limit config on req so rateLimiter can skip its DB call
      _.set(req, 'session.apiKey', {
        id: apiKeyRecord.id,
        cohortId: apiKeyRecord.cohortId,
        cohort: apiKeyRecord.Cohort,
        rateLimit: apiKeyRecord.rateLimit,
        rateLimitWindow: apiKeyRecord.rateLimitWindow,
        name: apiKeyRecord.name,
      })

      logger.info(`API key authenticated for cohort: ${apiKeyRecord.cohortId}`)
      next()
    } catch (error) {
      logger.error('API key validation error:', error)
      res.status(401).json({ success: false, error: 'Authentication failed' })
    }
  } else {
    res.status(401).json({ success: false, error: 'API key required' })
  }
}

module.exports = {
  validateApiKeyMiddleware,
}
