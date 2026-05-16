const _ = require('lodash')
const express = require('express')
const { fetchLoggedInUser, requireAdmin } = require('./api_util/api_util')
const { StackQuestion } = require('../db/models')

const router = express.Router()

router
  .route('/stackQuestions')
  // Create
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    let {
      questionText,
      dicomInitialId,
      answers,
      ignoreInPlaneRotation,
      alterVolumeView,
      alterSpacingThickness,
      hdBranchId,
      ldBranchId,
      questionType,
      positionSetId,
      postContrast,
      title,
      hideSetDelay,
      phaseNum,
      initialLocalizerWhitelist,
      displayVariants,
      displayVariantSelectionId,
    } = req.body

    let stackQuestion = await StackQuestion.create({
      questionText,
      dicomInitialId,
      answers,
      ignoreInPlaneRotation,
      alterVolumeView,
      alterSpacingThickness,
      hdBranchId,
      ldBranchId,
      questionType,
      positionSetId,
      postContrast,
      title,
      hideSetDelay,
      phaseNum,
      initialLocalizerWhitelist,
      displayVariants,
      displayVariantSelectionId,
    })
    res.json({ success: true, stackQuestionId: stackQuestion.id })
  })
  // List
  .get(async function (req, res) {
    let stackQuestions = await StackQuestion.findAll({
      order: [
        ['order', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    })

    let results = []

    for (let stackQuestion of stackQuestions) {
      results.push(
        _.extend(_.pick(stackQuestion, ['id', 'questionText']), {
          // dicomInitial...Name awaited here?
        })
      )
    }

    res.json(results)
  })

router
  .route('/stackQuestions/:id')
  .all(async function (req, res, next) {
    // runs for all HTTP verbs first
    // Fetch dicomFileSet first
    req.stackQuestion = await StackQuestion.findByPk(req.params.id)
    if (!req.stackQuestion) {
      res.status(404).json({ success: false })
    } else {
      next()
    }
  })
  .get(fetchLoggedInUser, async function (req, res) {
    let question = _.pick(req.stackQuestion, [
      'id',
      'questionText',
      'dicomInitialId',
      'answers',
      'ignoreInPlaneRotation',
      'alterVolumeView',
      'alterSpacingThickness',
      'hdBranchId',
      'ldBranchId',
      'questionType',
      'positionSetId',
      'postContrast',
      'title',
      'hideSetDelay',
      'phaseNum',
      'initialLocalizerWhitelist',
      'displayVariants',
      'displayVariantSelectionId',
    ])

    // only admins get told the full answers; otherwise just id+name
    // TODO Once we have the formula for scoring locked down and have time, we should move the scoring logic to the backend, and not send back answers
    // if(!req.session.user.isAdmin){
    //   question.answers = _.map(question.answers, function (answer) {
    //     return _.pick(answer, ['id','name'])
    //   })
    // }
    res.json(question)
  })
  // Edit
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    let stackQuestion = req.stackQuestion
    let {
      questionText,
      dicomInitialId,
      answers,
      ignoreInPlaneRotation,
      alterVolumeView,
      alterSpacingThickness,
      initialLocalizerWhitelist,
      hdBranchId,
      ldBranchId,
    } = req.body
    if (!_.isString(questionText) && questionText.length > 0) {
      res.status(400).json({ success: false })
    } else {
      _.extend(stackQuestion, {
        questionText,
        dicomInitialId,
        answers,
        ignoreInPlaneRotation,
        alterVolumeView,
        alterSpacingThickness,
        initialLocalizerWhitelist,
        hdBranchId,
        ldBranchId,
      })
      await stackQuestion.save()
      res.json({ success: true, stackQuestionId: stackQuestion.id })
    }
  })
  // Delete
  .delete(fetchLoggedInUser, requireAdmin, async function (req, res) {
    await req.stackQuestion.destroy()
    res.json({ success: true })
  })

module.exports = router
