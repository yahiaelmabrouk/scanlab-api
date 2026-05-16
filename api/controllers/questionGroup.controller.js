const express = require('express')
const router = express.Router()
const service = require('../services/questionGroup.service')

// Get all question groups
router.get('/questionGroups', async function (req, res) {
  try {
    let questionGroups = await service.getQuestionGroups()
    res.json({ success: true, data: { questionGroups } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get a single question group by ID
router.get('/questionGroups/:id', async function (req, res) {
  try {
    let questionGroup = await service.getQuestionGroupById(req.params.id)
    if (questionGroup) {
      res.json({ success: true, data: questionGroup })
    } else {
      res.status(404).json({ success: false, error: 'Question group not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create a new question group
router.post('/questionGroups', async function (req, res) {
  try {
    let questionGroup = await service.addQuestionGroup(req.body)
    res.status(201).json({ success: true, data: questionGroup })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Update a question group
router.put('/questionGroups/:id', async function (req, res) {
  try {
    let questionGroup = await service.updateQuestionGroup(req.params.id, req.body)
    if (questionGroup) {
      res.json({ success: true, data: questionGroup })
    } else {
      res.status(404).json({ success: false, error: 'Question group not found' })
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Delete a question group
router.delete('/questionGroups/:id', async function (req, res) {
  try {
    let deleted = await service.deleteQuestionGroup(req.params.id)
    if (deleted) {
      res.json({ success: true, message: 'Question group deleted successfully' })
    } else {
      res.status(404).json({ success: false, error: 'Question group not found' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
