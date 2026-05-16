const express = require('express')
const router = express.Router()
const service = require('../services/digitalLocalizer.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')

router.get('/digitalLocalizer/all', fetchLoggedInUser, async function (req, res) {
  try {
    const digitalLocalizers = await service.getAllDigitalLocalizers()
    res.json({ success: true, data: digitalLocalizers })
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message })
  }
})

router.get('/digitalLocalizer', fetchLoggedInUser, async function (req, res) {
  try {
    const bodyPartId = parseInt(req.query.bodyPartId, 10)
    if (isNaN(bodyPartId)) {
      return res.status(400).json({ success: false, message: 'Invalid Body Part ID' })
    }
    const digitalLocalizer = await service.getDigitalLocalizerByBodyPartId(bodyPartId)
    res.json({ success: true, data: digitalLocalizer })
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message })
  }
})

router.post('/digitalLocalizer', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    const { bodyPartId, minStep, maxStep } = req.body
    if (!bodyPartId || isNaN(bodyPartId)) {
      return res.status(400).json({ success: false, message: 'Invalid Body Part ID' })
    }
    const digitalLocalizer = await service.createDigitalLocalizer(bodyPartId, minStep, maxStep)
    res.json({ success: true, data: digitalLocalizer })
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message })
  }
})

router.put('/digitalLocalizer/:bodyPartId', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    const bodyPartId = parseInt(req.params.bodyPartId, 10)
    if (isNaN(bodyPartId)) {
      return res.status(400).json({ success: false, message: 'Invalid Body Part ID' })
    }
    const updateData = req.body
    const digitalLocalizer = await service.updateDigitalLocalizer(bodyPartId, updateData)
    res.json({ success: true, data: digitalLocalizer })
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message })
  }
})

router.delete('/digitalLocalizer/:bodyPartId', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    const bodyPartId = parseInt(req.params.bodyPartId, 10)
    if (isNaN(bodyPartId)) {
      return res.status(400).json({ success: false, message: 'Invalid Body Part ID' })
    }
    await service.deleteDigitalLocalizer(bodyPartId)
    res.json({ success: true, message: 'Digital Localizer deleted successfully' })
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message })
  }
})

module.exports = router
