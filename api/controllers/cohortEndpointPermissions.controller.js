const express = require('express')
const router = express.Router()
const CohortEndpointPermissionService = require('../services/cohortEndpointPermissions.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')
const logger = require('../../util/logger')

// Get all accessible endpoints for a cohort (cohort managers can see available endpoints)
router.get('/cohorts/:cohortId/accessible-endpoints', fetchLoggedInUser, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId } = req.params
    const { includeInactive = false, service, version } = req.query

    const endpoints = await CohortEndpointPermissionService.getCohortAccessibleEndpoints(user, parseInt(cohortId), {
      includeInactive: includeInactive === 'true',
      service,
      version,
    })

    res.json({
      success: true,
      data: endpoints,
    })
  } catch (error) {
    logger.error('Error fetching accessible endpoints for cohort:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get permissions for a specific cohort (admin only)
router.get('/cohorts/:cohortId/permissions', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId } = req.params

    const permissions = await CohortEndpointPermissionService.getCohortPermissions(user, parseInt(cohortId))

    res.json({
      success: true,
      data: permissions,
    })
  } catch (error) {
    logger.error('Error fetching cohort permissions:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 404).json({
      success: false,
      error: error.message,
    })
  }
})

// Grant permission for cohort to access endpoint (admin only)
router.post('/cohorts/:cohortId/permissions', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId } = req.params
    const { endpointId, maxRequestsPerHour, description } = req.body

    if (!endpointId) {
      return res.status(400).json({
        success: false,
        error: 'endpointId is required',
      })
    }

    const permission = await CohortEndpointPermissionService.grantPermission(
      user,
      parseInt(cohortId),
      parseInt(endpointId),
      { maxRequestsPerHour, description }
    )

    res.json({
      success: true,
      data: permission,
    })
  } catch (error) {
    logger.error('Error granting permission:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

// Revoke permission for cohort to access endpoint (admin only)
router.delete('/cohorts/:cohortId/permissions/:endpointId', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId, endpointId } = req.params

    const result = await CohortEndpointPermissionService.removePermission(
      user,
      parseInt(cohortId),
      parseInt(endpointId)
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('Error revoking permission:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

// Update permission settings (admin only)
router.patch('/cohorts/:cohortId/permissions/:endpointId', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId, endpointId } = req.params
    const { isAllowed, maxRequestsPerHour, description } = req.body

    if (isAllowed === false) {
      // Revoke permission
      const permission = await CohortEndpointPermissionService.revokePermission(
        user,
        parseInt(cohortId),
        parseInt(endpointId)
      )
      res.json({ success: true, data: permission })
    } else {
      // Grant or update permission
      const permission = await CohortEndpointPermissionService.grantPermission(
        user,
        parseInt(cohortId),
        parseInt(endpointId),
        { maxRequestsPerHour, description }
      )
      res.json({ success: true, data: permission })
    }
  } catch (error) {
    logger.error('Error updating permission:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

// Bulk grant permissions (admin only)
router.post('/cohorts/:cohortId/permissions/bulk', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId } = req.params
    const { endpointIds, maxRequestsPerHour, description } = req.body

    if (!Array.isArray(endpointIds) || endpointIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'endpointIds array is required',
      })
    }

    const results = await CohortEndpointPermissionService.bulkGrantPermissions(
      user,
      parseInt(cohortId),
      endpointIds.map((id) => parseInt(id)),
      { maxRequestsPerHour, description }
    )

    res.json({
      success: true,
      data: results,
    })
  } catch (error) {
    logger.error('Error bulk granting permissions:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

// Copy permissions from one cohort to another (admin only)
router.post(
  '/cohorts/:sourceCohortId/permissions/copy/:targetCohortId',
  fetchLoggedInUser,
  requireAdmin,
  async (req, res) => {
    try {
      const user = req.session.user
      const { sourceCohortId, targetCohortId } = req.params

      const results = await CohortEndpointPermissionService.copyPermissions(
        user,
        parseInt(sourceCohortId),
        parseInt(targetCohortId)
      )

      res.json({
        success: true,
        data: results,
      })
    } catch (error) {
      logger.error('Error copying permissions:', error)
      res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
        success: false,
        error: error.message,
      })
    }
  }
)

// Get permissions for a specific endpoint (admin only)
router.get('/endpoints/:endpointId/permissions', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { endpointId } = req.params

    const permissions = await CohortEndpointPermissionService.getEndpointPermissions(user, parseInt(endpointId))

    res.json({
      success: true,
      data: permissions,
    })
  } catch (error) {
    logger.error('Error fetching endpoint permissions:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 404).json({
      success: false,
      error: error.message,
    })
  }
})

// Get permission analytics for a cohort (admin only)
router.get('/cohorts/:cohortId/permissions/analytics', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const user = req.session.user
    const { cohortId } = req.params
    const { timeRange = '24h' } = req.query

    const analytics = await CohortEndpointPermissionService.getCohortPermissionAnalytics(
      user,
      parseInt(cohortId),
      timeRange
    )

    res.json({
      success: true,
      data: analytics,
    })
  } catch (error) {
    logger.error('Error fetching permission analytics:', error)
    res.status(error.message.includes('Unauthorized') ? 403 : 400).json({
      success: false,
      error: error.message,
    })
  }
})

module.exports = router
