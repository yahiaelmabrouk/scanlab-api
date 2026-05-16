const prisma = require('../../db/prisma')
const logger = require('../../util/logger')

async function trackApiKeyUsage(req, res, next) {
  // Only track usage for API key authenticated requests
  if (req.session && req.session.apiKey) {
    const originalJson = res.json

    // Override res.json to capture response status and track usage
    res.json = function (data) {
      // Track the API usage asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await prisma.apiKeyUsage.create({
            data: {
              apiKeyId: req.session.apiKey.id,
              endpoint: req.originalUrl || req.url,
              method: req.method,
              statusCode: res.statusCode,
              timestamp: new Date(),
              ipAddress: req.ip || req.socket.remoteAddress,
              userAgent: req.get('User-Agent') || null,
            },
          })
        } catch (error) {
          logger.error('Failed to track API key usage:', error)
        }
      })

      // Call original json method
      return originalJson.call(this, data)
    }
  }

  next()
}

module.exports = {
  trackApiKeyUsage,
}
