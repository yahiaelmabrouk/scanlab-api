const prisma = require('../../db/prisma')
const logger = require('../../util/logger')
const endpointRegistry = require('../services/endpointRegistry.service')
const cohortPermissionService = require('../services/cohortEndpointPermissions.service')

/**
 * Fire-and-forget: log without blocking the request pipeline.
 * Errors are swallowed and logged so they never affect latency.
 */
function logAccessAttemptAsync(attemptData) {
  prisma.endpointAccessAttempt
    .create({ data: attemptData })
    .catch((error) => logger.error('Error logging access attempt:', error))
}

/**
 * Middleware to validate API key permissions for specific endpoints
 */
async function validateEndpointPermissions(req, res, next) {
  // Skip validation if not using API key authentication
  if (!req.session || !req.session.apiKey) {
    return next()
  }

  const startTime = Date.now()
  const apiKey = req.session.apiKey
  const method = req.method
  const path = req.originalUrl || req.url

  // Remove query parameters from path for matching
  const cleanPath = path.split('?')[0]

  try {
    // Find matching endpoint in registry
    const endpoint = await endpointRegistry.matchEndpoint(method, cleanPath)

    if (!endpoint) {
      // Endpoint not registered - deny access
      logAccessAttemptAsync({
        apiKeyId: apiKey.id,
        endpointId: null,
        method,
        path: cleanPath,
        statusCode: 403,
        isAllowed: false,
        denyReason: 'Endpoint not registered',
        requestDuration: Date.now() - startTime,
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent'),
      })

      return res.status(403).json({
        success: false,
        error: 'This endpoint is not registered for API key access',
        code: 'ENDPOINT_NOT_REGISTERED',
      })
    }

    // Check if endpoint is active for API key access
    if (!endpoint.isActive) {
      logAccessAttemptAsync({
        apiKeyId: apiKey.id,
        endpointId: endpoint.id,
        method,
        path: cleanPath,
        statusCode: 403,
        isAllowed: false,
        denyReason: 'Endpoint not active for API access',
        requestDuration: Date.now() - startTime,
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent'),
      })

      return res.status(403).json({
        success: false,
        error: 'This endpoint is not available for API key access',
        code: 'ENDPOINT_NOT_ACTIVE',
      })
    }

    // Check cohort permissions for this endpoint
    const cohortPermission = await cohortPermissionService.checkCohortPermission(apiKey.cohortId, endpoint.id)

    if (!cohortPermission.hasPermission) {
      // No explicit permission - deny by default for security
      logAccessAttemptAsync({
        apiKeyId: apiKey.id,
        endpointId: endpoint.id,
        method,
        path: cleanPath,
        statusCode: 403,
        isAllowed: false,
        denyReason: 'No cohort permission granted for endpoint',
        requestDuration: Date.now() - startTime,
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent'),
      })

      return res.status(403).json({
        success: false,
        error: 'Access denied: Cohort does not have permission for this endpoint',
        code: 'NO_COHORT_PERMISSION',
      })
    }

    if (!cohortPermission.isAllowed) {
      // Explicitly denied
      logAccessAttemptAsync({
        apiKeyId: apiKey.id,
        endpointId: endpoint.id,
        method,
        path: cleanPath,
        statusCode: 403,
        isAllowed: false,
        denyReason: 'Cohort permission explicitly denied',
        requestDuration: Date.now() - startTime,
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent'),
      })

      return res.status(403).json({
        success: false,
        error: 'Access denied: Cohort permission explicitly denied for this endpoint',
        code: 'COHORT_PERMISSION_DENIED',
      })
    }

    // Check cohort-specific rate limiting if configured
    if (cohortPermission.maxRequestsPerHour) {
      const rateLimitCheck = await checkCohortEndpointRateLimit(
        apiKey.cohortId,
        endpoint.id,
        cohortPermission.maxRequestsPerHour
      )

      if (!rateLimitCheck.allowed) {
        logAccessAttemptAsync({
          apiKeyId: apiKey.id,
          endpointId: endpoint.id,
          method,
          path: cleanPath,
          statusCode: 429,
          isAllowed: false,
          denyReason: 'Cohort endpoint rate limit exceeded',
          requestDuration: Date.now() - startTime,
          ipAddress: getClientIP(req),
          userAgent: req.get('User-Agent'),
        })

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for this endpoint',
          code: 'COHORT_ENDPOINT_RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitCheck.retryAfter,
        })
      }
    }

    // Permission granted - log successful access (fire-and-forget)
    logAccessAttemptAsync({
      apiKeyId: apiKey.id,
      endpointId: endpoint.id,
      method,
      path: cleanPath,
      statusCode: 200,
      isAllowed: true,
      denyReason: null,
      requestDuration: Date.now() - startTime,
      ipAddress: getClientIP(req),
      userAgent: req.get('User-Agent'),
    })

    // Store endpoint info for later use
    req.endpoint = endpoint
    req.cohortPermission = cohortPermission.permission

    next()
  } catch (error) {
    logger.error('Error validating endpoint permissions:', error)

    // Log error attempt (fire-and-forget)
    logAccessAttemptAsync({
      apiKeyId: apiKey.id,
      endpointId: null,
      method,
      path: cleanPath,
      statusCode: 500,
      isAllowed: false,
      denyReason: 'Permission validation error',
      requestDuration: Date.now() - startTime,
      ipAddress: getClientIP(req),
      userAgent: req.get('User-Agent'),
    })

    return res.status(500).json({
      success: false,
      error: 'Internal error validating permissions',
      code: 'PERMISSION_VALIDATION_ERROR',
    })
  }
}

/**
 * Check cohort endpoint-specific rate limiting
 */
async function checkCohortEndpointRateLimit(cohortId, endpointId, maxRequestsPerHour) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago

  try {
    // Get all API keys for this cohort
    const apiKeys = await prisma.apiKey.findMany({
      where: { cohortId },
      select: { id: true },
    })

    const apiKeyIds = apiKeys.map((key) => key.id)

    // Count requests from all API keys in this cohort for this endpoint
    const requestCount = await prisma.endpointAccessAttempt.count({
      where: {
        apiKeyId: { in: apiKeyIds },
        endpointId,
        timestamp: {
          gte: windowStart,
        },
        isAllowed: true,
      },
    })

    if (requestCount >= maxRequestsPerHour) {
      const retryAfter = Math.ceil((windowStart.getTime() + 60 * 60 * 1000 - Date.now()) / 1000)
      return {
        allowed: false,
        currentCount: requestCount,
        maxAllowed: maxRequestsPerHour,
        retryAfter,
      }
    }

    return {
      allowed: true,
      currentCount: requestCount,
      maxAllowed: maxRequestsPerHour,
    }
  } catch (error) {
    logger.error('Error checking cohort endpoint rate limit:', error)
    // Fail open for now to avoid breaking API functionality
    return { allowed: true }
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  return req.ip || req.socket.remoteAddress || req.get('X-Forwarded-For') || req.get('X-Real-IP')
}

/**
 * Middleware to register endpoint automatically during development
 * Should only be used in development mode
 */
function autoRegisterEndpoint(endpointInfo) {
  return async function (req, res, next) {
    if (process.env.NODE_ENV === 'development') {
      try {
        await endpointRegistry.registerEndpoint({
          ...endpointInfo,
          path: req.originalUrl || req.url,
        })
      } catch (error) {
        logger.error('Error auto-registering endpoint:', error)
      }
    }
    next()
  }
}

module.exports = {
  validateEndpointPermissions,
  checkCohortEndpointRateLimit,
  logAccessAttempt: logAccessAttemptAsync,
  autoRegisterEndpoint,
  getClientIP,
}
