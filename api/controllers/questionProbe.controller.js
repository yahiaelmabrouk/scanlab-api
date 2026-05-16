const express = require('express')
const router = express.Router()
const service = require('../services/questionProbe.service')

// Get all question groups
router.get('/questionProbes', async function (req, res) {
  try {
    let questionProbes = await service.getQuestionProbes()
    res.json({ success: true, data: { questionProbes } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/questionProbe', async function (req, res) {
  try {
    const bodyPartId = req.query.bodyPartId
    const scanDirection = req.query.scanDirection
    let questionProbes = await service.getQuestionProbeByBodyPartId(bodyPartId, scanDirection)
    res.json({ success: true, data: { questionProbes } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get a single question group by ID
router.get('/questionProbe/:id', async function (req, res) {
  try {
    let questionProbe = await service.getQuestionProbeById(req.params.id)
    if (questionProbe) {
      res.json({ success: true, data: questionProbe })
    } else {
      res.status(404).json({ success: false, error: 'Question probe not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create a new question group
router.post('/questionProbe', async function (req, res) {
  try {
    let questionProbe = await service.addQuestionProbe(req.body)
    res.status(201).json({ success: true, data: questionProbe })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Update a question group
router.put('/questionProbe/:id', async function (req, res) {
  try {
    let questionProbe = await service.updateQuestionProbe(req.params.id, req.body)
    if (questionProbe) {
      res.json({ success: true, data: questionProbe })
    } else {
      res.status(404).json({ success: false, error: 'Question probe not found' })
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Delete a question group
router.delete('/questionProbe/:id', async function (req, res) {
  try {
    let deleted = await service.deleteQuestionProbe(req.params.id)
    if (deleted) {
      res.json({ success: true, message: 'Question probe deleted successfully' })
    } else {
      res.status(404).json({ success: false, error: 'Question probe not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
