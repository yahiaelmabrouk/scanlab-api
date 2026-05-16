const express = require('express')
const service = require('../services/questionSet.service')
const { fetchLoggedInUser, requireAdmin, requireAdminOrTranslator, isAdmin } = require('../api_util/api_util')
const util = require('../api_util/questionSet.util')
const _ = require('lodash')

const router = express.Router()

router
  .route('/questionSets')
  // Create
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    try {
      const questionSet = await service.createQuestionSet(req.body)

      res.json({ success: true, questionSet })
    } catch (error) {
      res.json({ success: false, error: error })
    }
  })
  // List
  .get(fetchLoggedInUser, requireAdminOrTranslator, async function (req, res) {
    const questionSets = await service.findAllQuestionSets(res)

    res.json({ success: true, questionSets })
  })

router
  .route('/questionSets/options')
  // List
  .get(fetchLoggedInUser, requireAdminOrTranslator, async function (req, res) {
    const questionSets = await service.findAllQuestionSetsAndAnswers(res)

    res.json({ success: true, questionSets })
  })

router
  .route('/questionSets/:id')
  .all(async function (req, res, next) {
    // runs for all HTTP verbs first
    // Fetch dicomFileSet first
    const questionSet = await service.findQuestionSetById(req.params.id)

    if (!questionSet) {
      res.status(404).json({ success: false })
    } else {
      req.questionSet = questionSet
      next()
    }
  })
  .get(fetchLoggedInUser, async function (req, res) {
    res.json({
      success: true,
      questionSet: await util.fillInAndSerializeQuestionSet(
        req.questionSet,
        !isAdmin(req.session.user) && _.get(req.query, ['isCTLab'], 0) != 1
      ),
    })
  })
  // Edit
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    try {
      const questionSet = await service.updateQuestionSet(req.questionSet, req.body)

      res.json({ success: true, questionSet })
    } catch (error) {
      const response = { success: false, error: error.message }

      if (error.message.includes('missing required fields')) {
        res.status(400).json(response)
      } else {
        res.status(500).json(response)
      }
    }
  })
  // Delete
  .delete(fetchLoggedInUser, requireAdmin, async function (req, res) {
    await service.deleteQuestionSet(req.questionSet)

    res.json({ success: true })
  })

router.post('/questionSets/:id/duplicate', async function (req, res) {
  try {
    let questionSet = await service.findQuestionSetById(req.params.id)

    if (!questionSet) {
      res.status(404).json({ success: false })
    }

    let stackQuestions = await questionSet.getStackQuestions()

    const updatedQuestionSet = {
      ...questionSet.toJSON(),
      dicomFileSet: req.body.dicomFileSet,
      stackQuestions,
    }

    questionSet = await service.createQuestionSet(updatedQuestionSet)

    res.json({ success: true, questionSet })
  } catch (error) {
    const response = { success: false, error: error.message }

    if (error.message.includes('missing required fields')) {
      res.status(400).json(response)
    } else {
      res.status(500).json(response)
    }
  }
})

module.exports = router
