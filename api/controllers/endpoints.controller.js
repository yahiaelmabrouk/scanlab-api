const express = require('express')
const router = express.Router()
const prisma = require('../../db/prisma')
const EndpointRegistryService = require('../services/endpointRegistry.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')
const logger = require('../../util/logger')

// Get all endpoints (admin only)
router.get('/endpoints', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { service, version, isActive } = req.query
    const filters = {}

    if (service) filters.service = service
    if (version) filters.version = version
    if (isActive !== undefined) filters.isActive = isActive === 'true'

    const endpoints = await EndpointRegistryService.getAllEndpoints(filters)

    res.json({
      success: true,
      data: endpoints,
    })
  } catch (error) {
    logger.error('Error fetching endpoints:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Create/register a new endpoint (admin only)
router.post('/endpoints', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
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
    } = req.body

    // Validate required fields
    if (!method || !pathPattern || !name) {
      return res.status(400).json({
        success: false,
        error: 'method, pathPattern, and name are required fields',
      })
    }

    const endpoint = await EndpointRegistryService.registerEndpoint({
      method,
      path: path || pathPattern,
      pathPattern,
      name,
      description,
      service,
      version,
      requiresAuth,
      isActive,
    })

    res.json({
      success: true,
      data: endpoint,
    })
  } catch (error) {
    logger.error('Error creating endpoint:', error)
    res.status(error.message.includes('already exists') ? 409 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

// Get a specific endpoint (admin only)
router.get('/endpoints/:endpointId', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpointId } = req.params

    const endpoint = await prisma.endpoint.findUnique({
      where: { id: parseInt(endpointId) },
      include: {
        cohortPermissions: {
          include: {
            cohort: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            cohortPermissions: true,
            accessAttempts: true,
          },
        },
      },
    })

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      })
    }

    res.json({
      success: true,
      data: endpoint,
    })
  } catch (error) {
    logger.error('Error fetching endpoint:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Update an endpoint (admin only)
router.patch('/endpoints/:endpointId', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpointId } = req.params
    const { name, description, service, requiresAuth, isActive } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (service !== undefined) updateData.service = service
    if (requiresAuth !== undefined) updateData.requiresAuth = requiresAuth
    if (isActive !== undefined) updateData.isActive = isActive

    const endpoint = await prisma.endpoint.update({
      where: { id: parseInt(endpointId) },
      data: updateData,
    })

    logger.info(`Endpoint updated: ${endpoint.method} ${endpoint.pathPattern}`)

    res.json({
      success: true,
      data: endpoint,
    })
  } catch (error) {
    logger.error('Error updating endpoint:', error)
    res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      error: error.code === 'P2025' ? 'Endpoint not found' : error.message,
    })
  }
})

// Delete an endpoint (admin only)
router.delete('/endpoints/:endpointId', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpointId } = req.params

    // First check if endpoint exists and get details for logging
    const endpoint = await prisma.endpoint.findUnique({
      where: { id: parseInt(endpointId) },
    })

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      })
    }

    // Delete the endpoint (permissions and access attempts will be cascade deleted)
    await prisma.endpoint.delete({
      where: { id: parseInt(endpointId) },
    })

    logger.info(`Endpoint deleted: ${endpoint.method} ${endpoint.pathPattern}`)

    res.json({
      success: true,
      message: 'Endpoint deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting endpoint:', error)
    res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      error: error.code === 'P2025' ? 'Endpoint not found' : error.message,
    })
  }
})

// Activate an endpoint for API key access (admin only)
router.patch('/endpoints/:endpointId/activate', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpointId } = req.params

    const endpoint = await prisma.endpoint.update({
      where: { id: parseInt(endpointId) },
      data: { isActive: true },
    })

    logger.info(`Endpoint activated: ${endpoint.method} ${endpoint.pathPattern}`)

    res.json({
      success: true,
      data: endpoint,
    })
  } catch (error) {
    logger.error('Error activating endpoint:', error)
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Deactivate an endpoint for API key access (admin only)
router.patch('/endpoints/:endpointId/deactivate', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpointId } = req.params

    const endpoint = await prisma.endpoint.update({
      where: { id: parseInt(endpointId) },
      data: { isActive: false },
    })

    logger.info(`Endpoint deactivated: ${endpoint.method} ${endpoint.pathPattern}`)

    res.json({
      success: true,
      data: endpoint,
    })
  } catch (error) {
    logger.error('Error deactivating endpoint:', error)
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Bulk register endpoints (admin only)
router.post('/endpoints/bulk', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const { endpoints } = req.body

    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'endpoints array is required',
      })
    }

    const results = await EndpointRegistryService.bulkRegisterEndpoints(endpoints)

    const successCount = results.filter((r) => !r.error).length
    const errorCount = results.filter((r) => r.error).length

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
        },
      },
    })
  } catch (error) {
    logger.error('Error bulk registering endpoints:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get endpoint services/categories (admin only)
router.get('/endpoints/services', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const services = await prisma.endpoint.findMany({
      select: {
        service: true,
      },
      distinct: ['service'],
      where: {
        service: {
          not: null,
        },
      },
      orderBy: {
        service: 'asc',
      },
    })

    const serviceList = services.map((s) => s.service).filter(Boolean)

    res.json({
      success: true,
      data: serviceList,
    })
  } catch (error) {
    logger.error('Error fetching endpoint services:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

module.exports = router
