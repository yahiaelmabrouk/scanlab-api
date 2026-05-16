const express = require('express')
const router = express.Router()
const service = require('../services/contrastRangePreset.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')

router.route('/contrastRangePresets').get(fetchLoggedInUser, requireAdmin, async function (req, res) {
  const presets = await service.findAll()
  res.json({ success: true, presets })
})

router.route('/contrastRangePresets').post(fetchLoggedInUser, requireAdmin, async function (req, res) {
  await service.create(req.body)
  res.json({ success: true })
})

router.route('/contrastRangePresets/:id').put(fetchLoggedInUser, requireAdmin, async function (req, res) {
  await service.update({ ...req.body, id: req.params.id })
  res.json({ success: true })
})

router.route('/contrastRangePresets/:id').delete(fetchLoggedInUser, requireAdmin, async function (req, res) {
  await service.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
