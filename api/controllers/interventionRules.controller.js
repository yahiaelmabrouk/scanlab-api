const express = require('express')
const router = express.Router()
const InterventionRulesService = require('../services/interventionRules.service')
const { fetchLoggedInUser, requireAdmin, requireAdminOrCohortManager } = require('../api_util/api_util')
const logger = require('../../util/logger')

function handleError(res, err, fallbackMessage) {
  if (res.headersSent) return
  const status = err && err.status ? err.status : 500
  if (status >= 500) logger.error(fallbackMessage || 'InterventionRules error', err)
  res.status(status).json({ success: false, error: err && err.message ? err.message : fallbackMessage })
}

async function listHandler(req, res) {
  try {
    const buckets = await InterventionRulesService.listAllBucketed()
    res.status(200).json({ success: true, ...buckets })
  } catch (err) {
    handleError(res, err, 'Failed to list intervention rules')
  }
}

router.get('/intervention-rules', fetchLoggedInUser, requireAdminOrCohortManager, listHandler)

router.get('/admin/intervention-rules', fetchLoggedInUser, requireAdmin, listHandler)

router.post('/admin/intervention-rules', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const userId = req.session.user && req.session.user.id
    if (!userId) {
      return res.status(400).json({ success: false, error: 'createdBy not derivable from session' })
    }
    const rule = await InterventionRulesService.create({ body: req.body, userId })
    res.status(201).json({ success: true, rule })
  } catch (err) {
    handleError(res, err, 'Failed to create intervention rule')
  }
})

router.put('/admin/intervention-rules/:id', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    const rule = await InterventionRulesService.update({ id: req.params.id, body: req.body })
    res.status(200).json({ success: true, rule })
  } catch (err) {
    handleError(res, err, 'Failed to update intervention rule')
  }
})

router.delete('/admin/intervention-rules/:id', fetchLoggedInUser, requireAdmin, async (req, res) => {
  try {
    await InterventionRulesService.remove(req.params.id)
    res.status(204).send()
  } catch (err) {
    handleError(res, err, 'Failed to delete intervention rule')
  }
})

module.exports = router
