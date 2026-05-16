const prisma = require('../../db/prisma')
const logger = require('../../util/logger')
const { isAdmin } = require('../api_util/api_util')
const { permissionCache } = require('../api_util/middlewareCache')

/**
 * Cohort Endpoint Permission Management Service
 */
class CohortEndpointPermissionService {
  /**
   * Grant permission for a cohort to access an endpoint (admin only)
   */
  async grantPermission(user, cohortId, endpointId, options = {}) {
    const { maxRequestsPerHour, description } = options

    try {
      // Check authorization - only admins can manage permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can manage endpoint permissions')
      }

      // Verify cohort exists
      const cohort = await prisma.cohort.findUnique({
        where: { id: cohortId },
      })

      if (!cohort) {
        throw new Error('Cohort not found')
      }

      // Verify endpoint exists
      const endpoint = await prisma.endpoint.findUnique({
        where: { id: endpointId },
      })

      if (!endpoint) {
        throw new Error('Endpoint not found')
      }

      // Create or update permission
      const permission = await prisma.cohortEndpointPermission.upsert({
        where: {
          cohortId_endpointId: {
            cohortId,
            endpointId,
          },
        },
        update: {
          isAllowed: true,
          maxRequestsPerHour,
          description,
        },
        create: {
          cohortId,
          endpointId,
          isAllowed: true,
          maxRequestsPerHour,
          description,
        },
        include: {
          endpoint: true,
          cohort: {
            select: { name: true },
          },
        },
      })

      logger.info(`Permission granted: Cohort ${cohort.name} can access ${endpoint.method} ${endpoint.pathPattern}`)
      permissionCache.delete(`perm:${cohortId}:${endpointId}`)
      return permission
    } catch (error) {
      logger.error('Error granting cohort endpoint permission:', error)
      throw error
    }
  }

  /**
   * Revoke permission for a cohort to access an endpoint (admin only)
   */
  async revokePermission(user, cohortId, endpointId) {
    try {
      // Check authorization - only admins can manage permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can manage endpoint permissions')
      }

      // Update permission to deny access
      const permission = await prisma.cohortEndpointPermission.upsert({
        where: {
          cohortId_endpointId: {
            cohortId,
            endpointId,
          },
        },
        update: {
          isAllowed: false,
        },
        create: {
          cohortId,
          endpointId,
          isAllowed: false,
        },
        include: {
          endpoint: true,
          cohort: {
            select: { name: true },
          },
        },
      })

      logger.info(
        `Permission revoked: Cohort ${permission.cohort.name} denied access to ${permission.endpoint.method} ${permission.endpoint.pathPattern}`
      )
      permissionCache.delete(`perm:${cohortId}:${endpointId}`)
      return permission
    } catch (error) {
      logger.error('Error revoking cohort endpoint permission:', error)
      throw error
    }
  }

  /**
   * Remove permission record entirely (admin only)
   */
  async removePermission(user, cohortId, endpointId) {
    try {
      // Check authorization - only admins can manage permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can manage endpoint permissions')
      }

      const deleted = await prisma.cohortEndpointPermission.deleteMany({
        where: {
          cohortId,
          endpointId,
        },
      })

      logger.info(`Permission removed: Cohort ${cohortId} permission deleted for endpoint ${endpointId}`)
      permissionCache.delete(`perm:${cohortId}:${endpointId}`)
      return { deleted: deleted.count }
    } catch (error) {
      logger.error('Error removing cohort endpoint permission:', error)
      throw error
    }
  }

  /**
   * Get all permissions for a cohort (admin only)
   */
  async getCohortPermissions(user, cohortId) {
    try {
      // Check authorization - only admins can view permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can view cohort permissions')
      }

      const permissions = await prisma.cohortEndpointPermission.findMany({
        where: { cohortId },
        include: {
          endpoint: {
            select: {
              id: true,
              method: true,
              pathPattern: true,
              name: true,
              description: true,
              service: true,
              version: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ endpoint: { service: 'asc' } }, { endpoint: { pathPattern: 'asc' } }],
      })

      return permissions
    } catch (error) {
      logger.error('Error getting cohort permissions:', error)
      throw error
    }
  }

  /**
   * Get all permissions for an endpoint
   */
  async getEndpointPermissions(user, endpointId) {
    try {
      // Only admins can view all endpoint permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can view endpoint permissions')
      }

      const permissions = await prisma.cohortEndpointPermission.findMany({
        where: { endpointId },
        include: {
          cohort: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ cohort: { name: 'asc' } }],
      })

      return permissions
    } catch (error) {
      logger.error('Error getting endpoint permissions:', error)
      throw error
    }
  }

  /**
   * Bulk grant permissions for multiple endpoints
   */
  async bulkGrantPermissions(user, cohortId, endpointIds, options = {}) {
    const results = []

    for (const endpointId of endpointIds) {
      try {
        const permission = await this.grantPermission(user, cohortId, endpointId, options)
        results.push({ success: true, endpointId, permission })
      } catch (error) {
        results.push({ success: false, endpointId, error: error.message })
      }
    }

    return results
  }

  /**
   * Copy permissions from one cohort to another (admin only)
   */
  async copyPermissions(user, sourceCohortId, targetCohortId) {
    try {
      // Check authorization - only admins can manage permissions
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can manage endpoint permissions')
      }

      const [sourceCohort, targetCohort] = await Promise.all([
        prisma.cohort.findUnique({ where: { id: sourceCohortId } }),
        prisma.cohort.findUnique({ where: { id: targetCohortId } }),
      ])

      if (!sourceCohort || !targetCohort) {
        throw new Error('One or both cohorts not found')
      }

      // Get source permissions
      const sourcePermissions = await prisma.cohortEndpointPermission.findMany({
        where: { cohortId: sourceCohortId },
      })

      // Copy permissions to target
      const copyResults = []
      for (const sourcePerm of sourcePermissions) {
        try {
          const newPermission = await prisma.cohortEndpointPermission.upsert({
            where: {
              cohortId_endpointId: {
                cohortId: targetCohortId,
                endpointId: sourcePerm.endpointId,
              },
            },
            update: {
              isAllowed: sourcePerm.isAllowed,
              maxRequestsPerHour: sourcePerm.maxRequestsPerHour,
              description: `Copied from ${sourceCohort.name}`,
            },
            create: {
              cohortId: targetCohortId,
              endpointId: sourcePerm.endpointId,
              isAllowed: sourcePerm.isAllowed,
              maxRequestsPerHour: sourcePerm.maxRequestsPerHour,
              description: `Copied from ${sourceCohort.name}`,
            },
          })
          copyResults.push({ success: true, endpointId: sourcePerm.endpointId, permission: newPermission })
        } catch (error) {
          copyResults.push({ success: false, endpointId: sourcePerm.endpointId, error: error.message })
        }
      }

      logger.info(
        `Copied ${copyResults.filter((r) => r.success).length} permissions from ${sourceCohort.name} to ${
          targetCohort.name
        }`
      )
      return copyResults
    } catch (error) {
      logger.error('Error copying permissions:', error)
      throw error
    }
  }

  /**
   * Get all accessible endpoints for a cohort
   */
  async getCohortAccessibleEndpoints(user, cohortId, options = {}) {
    const { includeInactive = false, service, version } = options

    try {
      // Check authorization
      if (!isAdmin(user)) {
        const userManagedCohortIds = user.managedCohorts ? user.managedCohorts.map((c) => c.id) : []
        if (!userManagedCohortIds.includes(cohortId)) {
          throw new Error('Unauthorized: Cannot view endpoints for this cohort')
        }
      }

      // Get all endpoints that can be assigned to cohorts
      const whereClause = {
        requiresAuth: true, // Only show endpoints that require authentication
      }

      // Only show active endpoints unless specifically requested
      if (!includeInactive) {
        whereClause.isActive = true
      }

      // Filter by service if provided
      if (service) {
        whereClause.service = service
      }

      // Filter by version if provided
      if (version) {
        whereClause.version = version
      }

      const endpoints = await prisma.endpoint.findMany({
        where: whereClause,
        include: {
          cohortPermissions: {
            where: {
              cohortId: cohortId,
            },
            select: {
              id: true,
              isAllowed: true,
              maxRequestsPerHour: true,
              description: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ service: 'asc' }, { pathPattern: 'asc' }, { method: 'asc' }],
      })

      // Format response with permission status
      const endpointsWithPermissions = endpoints.map((endpoint) => {
        const permission = endpoint.cohortPermissions[0] || null
        return {
          id: endpoint.id,
          method: endpoint.method,
          pathPattern: endpoint.pathPattern,
          name: endpoint.name,
          description: endpoint.description,
          service: endpoint.service,
          version: endpoint.version,
          isActive: endpoint.isActive,
          permission: permission
            ? {
                id: permission.id,
                isAllowed: permission.isAllowed,
                maxRequestsPerHour: permission.maxRequestsPerHour,
                description: permission.description,
                grantedAt: permission.createdAt,
              }
            : null,
          hasPermission: !!permission,
          isAllowed: permission?.isAllowed || false,
        }
      })

      return endpointsWithPermissions
    } catch (error) {
      logger.error('Error getting cohort accessible endpoints:', error)
      throw error
    }
  }

  /**
   * Check if a cohort has permission to access an endpoint.
   * PERF: cached in memory – avoids a DB round-trip on every request.
   */
  async checkCohortPermission(cohortId, endpointId) {
    const cacheKey = `perm:${cohortId}:${endpointId}`
    const cached = permissionCache.get(cacheKey)
    if (cached) return cached

    try {
      const permission = await prisma.cohortEndpointPermission.findUnique({
        where: {
          cohortId_endpointId: {
            cohortId,
            endpointId,
          },
        },
      })

      const result = {
        hasPermission: !!permission,
        isAllowed: permission?.isAllowed || false,
        maxRequestsPerHour: permission?.maxRequestsPerHour || null,
        permission,
      }

      permissionCache.set(cacheKey, result)
      return result
    } catch (error) {
      logger.error('Error checking cohort permission:', error)
      return {
        hasPermission: false,
        isAllowed: false,
        maxRequestsPerHour: null,
        permission: null,
      }
    }
  }

  /**
   * Get permission usage analytics for a cohort (admin only)
   */
  async getCohortPermissionAnalytics(user, cohortId, timeRange = '24h') {
    try {
      // Check authorization - only admins can view analytics
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Only admins can view permission analytics')
      }

      // Calculate time range
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }

      const since = new Date(Date.now() - (timeRangeMs[timeRange] || timeRangeMs['24h']))

      // Get all API keys for this cohort
      const apiKeys = await prisma.apiKey.findMany({
        where: { cohortId },
        select: { id: true },
      })

      const apiKeyIds = apiKeys.map((key) => key.id)

      const analytics = await prisma.endpointAccessAttempt.groupBy({
        by: ['endpointId', 'isAllowed', 'statusCode'],
        where: {
          apiKeyId: { in: apiKeyIds },
          timestamp: { gte: since },
        },
        _count: true,
        orderBy: {
          _count: {
            endpointId: 'desc',
          },
        },
      })

      // Get endpoint details
      const endpointIds = [...new Set(analytics.map((a) => a.endpointId).filter(Boolean))]
      const endpoints = await prisma.endpoint.findMany({
        where: { id: { in: endpointIds } },
        select: { id: true, method: true, pathPattern: true, name: true, service: true },
      })

      const endpointMap = new Map(endpoints.map((e) => [e.id, e]))

      // Format analytics
      const formatted = analytics.map((stat) => ({
        endpoint: endpointMap.get(stat.endpointId),
        isAllowed: stat.isAllowed,
        statusCode: stat.statusCode,
        requestCount: stat._count,
      }))

      return {
        timeRange,
        since,
        analytics: formatted,
        summary: {
          totalRequests: analytics.reduce((sum, stat) => sum + stat._count, 0),
          allowedRequests: analytics.filter((stat) => stat.isAllowed).reduce((sum, stat) => sum + stat._count, 0),
          deniedRequests: analytics.filter((stat) => !stat.isAllowed).reduce((sum, stat) => sum + stat._count, 0),
        },
      }
    } catch (error) {
      logger.error('Error getting cohort permission analytics:', error)
      throw error
    }
  }
}

module.exports = new CohortEndpointPermissionService()
