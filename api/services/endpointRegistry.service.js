const prisma = require('../../db/prisma')
const logger = require('../../util/logger')
const _ = require('lodash')
const { endpointCache } = require('../api_util/middlewareCache')

/**
 * Endpoint Registry Service
 * Handles automatic discovery and registration of API endpoints
 */
class EndpointRegistryService {
  constructor() {
    this.registeredEndpoints = new Map()
    /** Compile-once cache: pathPattern → RegExp */
    this._regexCache = new Map()
  }

  /**
   * Register an endpoint in the system
   * @param {Object} endpointInfo
   * @param {string} endpointInfo.method - HTTP method (GET, POST, etc.)
   * @param {string} endpointInfo.path - Actual path
   * @param {string} endpointInfo.pathPattern - Pattern for matching (with params like :id)
   * @param {string} endpointInfo.name - Human readable name
   * @param {string} endpointInfo.description - Description of the endpoint
   * @param {string} endpointInfo.service - Service name (e.g., 'cohorts', 'dicom')
   * @param {string} endpointInfo.version - API version (default: 'v1')
   * @param {boolean} endpointInfo.requiresAuth - Whether endpoint requires authentication
   * @param {boolean} endpointInfo.isActive - Whether endpoint is active (default: false for security)
   */
  async registerEndpoint(endpointInfo) {
    const {
      method,
      path,
      pathPattern,
      name,
      description,
      service,
      version = 'v1',
      requiresAuth = true,
      isActive = false,
    } = endpointInfo

    const key = `${method}:${pathPattern}:${version}`

    try {
      // Check if endpoint already exists
      const existingEndpoint = await prisma.endpoint.findUnique({
        where: {
          method_pathPattern_version: {
            method: method.toUpperCase(),
            pathPattern,
            version,
          },
        },
      })

      if (existingEndpoint) {
        // Update existing endpoint if details changed
        const updatedEndpoint = await prisma.endpoint.update({
          where: { id: existingEndpoint.id },
          data: {
            path,
            name,
            description,
            service,
            requiresAuth,
            isActive,
          },
        })

        this.registeredEndpoints.set(key, updatedEndpoint)
        endpointCache.clear() // invalidate matchEndpoint cache
        logger.info(`Updated endpoint registration: ${method} ${pathPattern}`)
        return updatedEndpoint
      } else {
        // Create new endpoint
        const newEndpoint = await prisma.endpoint.create({
          data: {
            method: method.toUpperCase(),
            path,
            pathPattern,
            name,
            description,
            service,
            version,
            requiresAuth,
            isActive,
          },
        })

        this.registeredEndpoints.set(key, newEndpoint)
        endpointCache.clear() // invalidate matchEndpoint cache
        logger.info(`Registered new endpoint: ${method} ${pathPattern}`)
        return newEndpoint
      }
    } catch (error) {
      logger.error(`Failed to register endpoint ${method} ${pathPattern}:`, error)
      throw error
    }
  }

  /**
   * Find endpoint by method and path pattern
   */
  async findEndpoint(method, pathPattern, version = 'v1') {
    const key = `${method.toUpperCase()}:${pathPattern}:${version}`

    // Check cache first
    if (this.registeredEndpoints.has(key)) {
      return this.registeredEndpoints.get(key)
    }

    // Query database
    try {
      const endpoint = await prisma.endpoint.findUnique({
        where: {
          method_pathPattern_version: {
            method: method.toUpperCase(),
            pathPattern,
            version,
          },
        },
      })

      if (endpoint) {
        this.registeredEndpoints.set(key, endpoint)
      }

      return endpoint
    } catch (error) {
      logger.error(`Failed to find endpoint ${method} ${pathPattern}:`, error)
      return null
    }
  }

  /**
   * Match a request path to a registered endpoint pattern.
   * PERF: caches the full active-endpoint list per method+version
   * so repeated requests don't hit the DB.
   */
  async matchEndpoint(method, requestPath, version = 'v1') {
    try {
      const cacheKey = `active:${method.toUpperCase()}:${version}`
      let endpoints = endpointCache.get(cacheKey)

      if (!endpoints) {
        endpoints = await prisma.endpoint.findMany({
          where: {
            method: method.toUpperCase(),
            version,
            isActive: true,
          },
        })
        // Cache for 5 min (default TTL) – admin changes take ≤5 min to propagate
        endpointCache.set(cacheKey, endpoints)
      }

      // Try to match path patterns
      for (const endpoint of endpoints) {
        if (this.pathMatches(requestPath, endpoint.pathPattern)) {
          return endpoint
        }
      }

      return null
    } catch (error) {
      logger.error(`Failed to match endpoint for ${method} ${requestPath}:`, error)
      return null
    }
  }

  /**
   * Check if a request path matches an endpoint pattern.
   * Supports Express-style route parameters like :id, :cohortId.
   *
   * PERF: compiled RegExp objects are cached in `_regexCache` keyed by
   * pathPattern so each pattern is compiled exactly once for the lifetime
   * of the process, regardless of how many API-key requests arrive.
   */
  pathMatches(requestPath, pathPattern) {
    let regex = this._regexCache.get(pathPattern)
    if (!regex) {
      // Convert Express route pattern to regex
      const regexPattern = pathPattern
        .replace(/:[^/]+/g, '([^/]+)') // Replace :param with capture group
        .replace(/\//g, '\\/') // Escape forward slashes
      regex = new RegExp(`^${regexPattern}$`)
      this._regexCache.set(pathPattern, regex)
    }
    return regex.test(requestPath)
  }

  /**
   * Get all registered endpoints
   */
  async getAllEndpoints(filters = {}) {
    try {
      const where = {}

      if (filters.service) {
        where.service = filters.service
      }

      if (filters.version) {
        where.version = filters.version
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      return await prisma.endpoint.findMany({
        where,
        orderBy: [{ service: 'asc' }, { pathPattern: 'asc' }, { method: 'asc' }],
      })
    } catch (error) {
      logger.error('Failed to get all endpoints:', error)
      throw error
    }
  }

  /**
   * Bulk register endpoints from route definitions
   */
  async bulkRegisterEndpoints(endpoints) {
    const results = []

    for (const endpointInfo of endpoints) {
      try {
        const result = await this.registerEndpoint(endpointInfo)
        results.push(result)
      } catch (error) {
        logger.error(`Failed to register endpoint ${endpointInfo.method} ${endpointInfo.pathPattern}:`, error)
        results.push({ error: error.message, ...endpointInfo })
      }
    }

    return results
  }

  /**
   * Activate an endpoint for API key access
   */
  async activateEndpoint(method, pathPattern, version = 'v1') {
    try {
      const endpoint = await prisma.endpoint.updateMany({
        where: {
          method: method.toUpperCase(),
          pathPattern,
          version,
        },
        data: {
          isActive: true,
        },
      })

      endpointCache.clear() // invalidate matchEndpoint cache
      logger.info(`Activated endpoint: ${method} ${pathPattern}`)
      return endpoint
    } catch (error) {
      logger.error(`Failed to activate endpoint ${method} ${pathPattern}:`, error)
      throw error
    }
  }

  /**
   * Deactivate endpoints that are no longer in use
   */
  async deactivateEndpoint(method, pathPattern, version = 'v1') {
    try {
      const endpoint = await prisma.endpoint.updateMany({
        where: {
          method: method.toUpperCase(),
          pathPattern,
          version,
        },
        data: {
          isActive: false,
        },
      })

      endpointCache.clear() // invalidate matchEndpoint cache
      logger.info(`Deactivated endpoint: ${method} ${pathPattern}`)
      return endpoint
    } catch (error) {
      logger.error(`Failed to deactivate endpoint ${method} ${pathPattern}:`, error)
      throw error
    }
  }
}

// Export singleton instance
module.exports = new EndpointRegistryService()
