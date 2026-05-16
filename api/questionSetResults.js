const express = require('express')
const { Op } = require('sequelize')
const router = express.Router()
const _ = require('lodash')
const {
  BodyPart,
  QuestionSet,
  StackQuestion,
  MultipleChoiceQuestion,
  sequelize,
  InjectionAttribute,
  WeightBasedDose,
} = require('../db/models')
const criticalThinkingSvc = require('./services/criticalThinkingQuestion.service')
const sliceQuantGradingCTUtil = require('./api_util/sliceQuantGradingCT.util')
const sliceQuantGradingUltraLabUtil = require('./api_util/sliceQuantGradingUltraLab.util')
const sliceQuantGradingMRBasicUtil = require('./api_util/sliceQuantGradingMRBasic.util')
const sliceQuantGradingResolutionUtil = require('./api_util/sliceQuantGradingResolution.util')
const sliceQuantGradingContrastUtil = require('./api_util/sliceQuantGradingContrast.util')
const statsCacheHelper = require('./statsCacheHelper')
// const skillScoresCTUtil = require('./api_util/skillScoresCT.util.js')
//const skillScoresUltraLabUtil = require('./api_util/skillScoresUltraLab.util.js')
// const skillScoresContrastUtil = require('./api_util/skillScoresContrast.util.js')
// const skillScoresResolutionUtil = require('./api_util/skillScoresResolution.util.js')
// const skillScoresMRBasicUtil = require('./api_util/skillScoresMRBasic.util.js')
const {
  fetchLoggedInUser,
  isManagerOrAdmin,
  isAdmin,
  isContrastLab,
  requireAdmin,
  isResolutionLab,
  serializeSliceViews,
} = require('./api_util/api_util')
const {
  calculateGroupScoreVariables,
  flatScoreFromGroupScoreVariables,
  serializeGroupScoreVariables,
  getRubric,
} = require('./api_util/score')
const { CLIENT_PRODUCTION_HOSTNAMES } = require('../util/constants')
const ModelProvider = require('./providers/model.provider')
const QuestionSetResultService = require('./services/questionSetResult.service')
const { getCachedWeightBasedDoses } = require('./api_util/middlewareCache')

router.get('/results/rubric/:stackQuestionId', fetchLoggedInUser, requireAdmin, async function (req, res) {
  const { stackQuestionId } = req.params
  const { isCTLab } = req.query
  const isProduction = CLIENT_PRODUCTION_HOSTNAMES.includes(req.hostname)

  let stackQuestion = await StackQuestion.findOne({
    where: {
      id: stackQuestionId,
    },
    include: [
      {
        model: QuestionSet,
        required: true,
        as: 'QuestionSet',
        include: [
          {
            model: BodyPart,
            required: true,
            as: 'bodyPart',
            attributes: ['name'],
          },
        ],
      },
    ],
  })
  const contrastLab = isContrastLab(stackQuestion.QuestionSet.bodyPart.name)
  const resolutionLab = isResolutionLab(stackQuestion.QuestionSet.bodyPart.name)

  const rubric = getRubric(stackQuestion.answers[0], {
    ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
    isContrastLab: contrastLab,
    isResolutionLab: resolutionLab,
    isUltraLab: stackQuestion.QuestionSet.isUltraLab,
    isCTLab: isCTLab == 1,
    isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
    isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
    questionType: _.get(stackQuestion, 'questionType', -1),
    isPostContrast: stackQuestion.postContrast,
    isProduction,
  })

  res.json({
    success: true,
    rubric,
  })
})

router.post('/results/preview', fetchLoggedInUser, async function (req, res) {
  const answer = req.body
  const { isCTLab } = req.query
  const isProduction = CLIENT_PRODUCTION_HOSTNAMES.includes(req.hostname)
  const modelProvider = await ModelProvider.getModelProvider(req.session.user.id)

  const userIsAdmin = isAdmin(req.session.user)
  const userIsManagerOrAdmin = await isManagerOrAdmin(req.session.user)
  const testRun = answer.testId ? await modelProvider.TestRun.findByPk(answer.testId) : null

  // always for admins/managers, but also for users when the test in in sandbox
  if (!userIsManagerOrAdmin && !_.get(testRun, 'isSandbox')) {
    res.json({
      success: false,
    })
    return
  }

  let stackQuestion = await StackQuestion.findOne({
    where: {
      id: answer.stackQuestionId,
    },
    include: [
      {
        model: QuestionSet,
        required: true,
        as: 'QuestionSet',
        include: [
          {
            model: BodyPart,
            required: true,
            as: 'bodyPart',
            attributes: ['name'],
            include: [
              {
                model: InjectionAttribute,
                required: false,
                as: 'injectionAttributes',
                attributes: [
                  'contrastMinDose',
                  'contrastMaxDose',
                  'contrastMinFlowRate',
                  'contrastMaxFlowRate',
                  'salineMinDose',
                  'salineMaxDose',
                  'salineMinFlowRate',
                  'salineMaxFlowRate',
                  'minTime',
                  'maxTime',
                  'posts',
                ],
              },
            ],
          },
        ],
      },
    ],
  })

  const injectionAttribute = _.get(stackQuestion, ['QuestionSet', 'bodyPart', 'injectionAttributes', 0], null)
  // PERF: use in-memory cache – avoids a full-table scan on every request
  let weightBasedDoses = await getCachedWeightBasedDoses(WeightBasedDose)

  // For users who are able to get a score preview only for TestRuns in sandbox mode, ensure the TestRun they passed in actually contains the StackQuestion that they are about to be told their score to
  //   without this, they could just always pass in the same TestRun id and get the score preview for any StackQuestion
  if (!userIsManagerOrAdmin) {
    let questionSetId = stackQuestion.questionSet
    let testRunQuestionSetData = _.find(testRun.questions, { type: 'QUESTIONSET' })
    if (questionSetId !== _.get(testRunQuestionSetData, 'id')) {
      res.json({
        success: false,
      })
      return
    }
  }

  const contrastLab = isContrastLab(stackQuestion.QuestionSet.bodyPart.name)
  const resolutionLab = isResolutionLab(stackQuestion.QuestionSet.bodyPart.name)
  const ultraLab = stackQuestion.QuestionSet.isUltraLab

  let selectedAnswer = _.find(stackQuestion.answers, { id: answer.answerSelectionId })

  const attributes = { injectionAttribute, weightBasedDoses }
  // this is the original grading logic
  let groupScoreVariables = calculateGroupScoreVariables(
    answer.variables,
    selectedAnswer,
    {
      ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
      isContrastLab: contrastLab,
      isResolutionLab: resolutionLab,
      isUltraLab: ultraLab,
      isCTLab: isCTLab == 1,
      isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
      isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
      questionType: _.get(stackQuestion, 'questionType', -1),
      isPostContrast: stackQuestion.postContrast,
      phaseNum: _.get(stackQuestion, 'phaseNum', 1),
      isProduction,
    },
    answer.rubric,
    attributes
  )

  // this is the new grading logic
  // the old and new are still being used while the new grading is being tested/developed
  // so current users don't experience service interuptions
  let sliceQuantScore = null
  //let skillScores = null // Only used for testing (see below)
  if (isCTLab == 1) {
    sliceQuantScore = sliceQuantGradingCTUtil.calculateScores(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
        isContrastLab: contrastLab,
        isResolutionLab: resolutionLab,
        isCTLab: isCTLab,
        isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
        isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
        questionType: _.get(stackQuestion, 'questionType', -1),
        isPostContrast: stackQuestion.postContrast,
        phaseNum: _.get(stackQuestion, 'phaseNum', 1),
        isProduction,
      },
      answer.rubric,
      attributes
    )
    //skillScores = skillScoresCTUtil.calculateScores(sliceQuantScore, {
    //  isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
    //  isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
    //  questionType: _.get(stackQuestion, 'questionType', -1),
    //  isPostContrast: stackQuestion.postContrast,
    //  phaseNum: _.get(stackQuestion, 'phaseNum', 1),
    //})
  } else if (ultraLab) {
    sliceQuantScore = sliceQuantGradingUltraLabUtil.calculateScores(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
        isContrastLab: contrastLab,
        isResolutionLab: resolutionLab,
        isUltraLab: ultraLab,
        isCTLab: isCTLab == 1,
        isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
        isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
        questionType: _.get(stackQuestion, 'questionType', -1),
        isPostContrast: stackQuestion.postContrast,
        phaseNum: _.get(stackQuestion, 'phaseNum', 1),
        dontGradeEfficiency: stackQuestion.dontGradeEfficiency,
        dontGradePixelShift: stackQuestion.dontGradePixelShift,
        hasSpecialtyOptions: stackQuestion.hasSpecialtyOptions,
        gradeContats: stackQuestion.gradeContats,
        isProduction,
      },
      answer.rubric,
      attributes
    )
    // Below is only for testing, skill scores are processed and saved at end of the exam
    /*
    skillScores = skillScoresUltraLabUtil.calculateScores(sliceQuantScore, {
      dontGradeEfficiency: stackQuestion.dontGradeEfficiency,
      dontGradePixelShift: stackQuestion.dontGradePixelShift,
      gradeContats: stackQuestion.gradeContats,
      hasSpecialtyOptions: stackQuestion.hasSpecialtyOptions,
      specialtyOption: answer.variables[0].specialtyOption,
    })
    */
  } else if (contrastLab) {
    sliceQuantScore = sliceQuantGradingContrastUtil.calculateScores(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
        isContrastLab: contrastLab,
        isResolutionLab: resolutionLab,
        isUltraLab: ultraLab,
        isCTLab: isCTLab == 1,
        isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
        isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
        questionType: _.get(stackQuestion, 'questionType', -1),
        isPostContrast: stackQuestion.postContrast,
        phaseNum: _.get(stackQuestion, 'phaseNum', 1),
        isProduction,
      },
      answer.rubric,
      attributes
    )
    // Below is only for testing, skill scores are processed and saved at end of the exam
    //skillScores = skillScoresContrastUtil.calculateScores(sliceQuantScore)
  } else if (resolutionLab) {
    sliceQuantScore = sliceQuantGradingResolutionUtil.calculateScores(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
        isContrastLab: contrastLab,
        isResolutionLab: resolutionLab,
        isUltraLab: ultraLab,
        isCTLab: isCTLab == 1,
        isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
        isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
        questionType: _.get(stackQuestion, 'questionType', -1),
        isPostContrast: stackQuestion.postContrast,
        phaseNum: _.get(stackQuestion, 'phaseNum', 1),
        isProduction,
      },
      answer.rubric,
      attributes
    )
    // Below is only for testing, skill scores are processed and saved at end of the exam
    //skillScores = skillScoresResolutionUtil.calculateScores(sliceQuantScore)
  } else {
    sliceQuantScore = sliceQuantGradingMRBasicUtil.calculateScores(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
        isContrastLab: contrastLab,
        isResolutionLab: resolutionLab,
        isUltraLab: ultraLab,
        isCTLab: isCTLab == 1,
        isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
        isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
        questionType: _.get(stackQuestion, 'questionType', -1),
        isPostContrast: stackQuestion.postContrast,
        phaseNum: _.get(stackQuestion, 'phaseNum', 1),
        isProduction,
      },
      answer.rubric,
      attributes
    )
    // Below is only for testing, skill scores are processed and saved at end of the exam
    //skillScores = skillScoresMRBasicUtil.calculateScores(sliceQuantScore)
  }

  let output = {
    success: true,
    ...groupScoreVariables, // this endpoint is for admins-only, so doesn't need to be serialized/stripped for sensitive data
    sliceQuantScore,
    //skillScores, // being return for testing purposes. Can be removed later
  }

  if (!userIsAdmin) {
    delete output.score
  }

  groupScoreVariables.groupScoreVariables.forEach((gVar) => {
    if (
      // If you do not have IR enabled and that is correct,
      // don't show inversion time output in preview
      gVar.scoreVariables['inversionRecoveryIs'] === false &&
      gVar.scoreVariables['inversionRecoveryShouldBe'] === undefined
    ) {
      delete gVar.scoreVariables['inversionTimeOff']
      delete gVar.scoreVariables['inversionTimeTooHigh']
      delete gVar.scoreVariables['inversionTimeTooLow']
    }
  })

  res.json(output)
})

// TODO: Add authorization. Only the student who took the exam, their manager, or an admin should be allowed access
router.get('/results/review/questionSet/:questionSetResultId', async function (req, res) {
  const { questionSetResultId } = req.params
  const { isCTLab } = req.query
  const userId = req.query.userId
  const isProduction = CLIENT_PRODUCTION_HOSTNAMES.includes(req.hostname)
  const modelProvider = await ModelProvider.getModelProvider(userId)

  const questionSetSql = QuestionSetResultService.getQueryQuestionSetSql(modelProvider)
  let questionSetResult = await sequelize.query(questionSetSql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { id: questionSetResultId },
  })
  questionSetResult = _.get(questionSetResult, [0], null)
  if (!questionSetResult) {
    res.status(404).json({ success: false })
    return
  }

  const stackQuestionResultSql = QuestionSetResultService.getQueryStackQuestionResultSql(modelProvider)
  let stackQuestionResultsData = await sequelize.query(stackQuestionResultSql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { questionSetResultId },
  })

  let dicomFileSetId = null
  let bodyPartId = null

  // grade the stack questions
  let stackQuestionResults = []
  // Batch-load all stack questions in a single query to avoid N+1
  const allStackQuestionIds = [...new Set(stackQuestionResultsData.map((a) => a.stackQuestionId))]
  const [stackQuestionsArr, weightBasedDoses] = await Promise.all([
    StackQuestion.findAll({
      where: {
        id: { [Op.in]: allStackQuestionIds },
      },
      include: [
        {
          model: QuestionSet,
          required: true,
          as: 'QuestionSet',
          include: [
            {
              model: BodyPart,
              required: true,
              as: 'bodyPart',
              attributes: ['name'],
              include: [
                {
                  model: InjectionAttribute,
                  required: false,
                  as: 'injectionAttributes',
                  attributes: [
                    'contrastMinDose',
                    'contrastMaxDose',
                    'contrastMinFlowRate',
                    'contrastMaxFlowRate',
                    'salineMinDose',
                    'salineMaxDose',
                    'salineMinFlowRate',
                    'salineMaxFlowRate',
                    'minTime',
                    'maxTime',
                    'posts',
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
    // PERF: use in-memory cache – avoids a full-table scan on every request
    getCachedWeightBasedDoses(WeightBasedDose),
  ])
  const stackQuestionsMap = _.keyBy(stackQuestionsArr, 'id')

  for (const answer of stackQuestionResultsData) {
    let stackQuestion = stackQuestionsMap[answer.stackQuestionId]
    const injectionAttribute = _.get(stackQuestion, ['QuestionSet', 'bodyPart', 'injectionAttributes', 0], null)
    const contrastLab = isContrastLab(stackQuestion.QuestionSet.bodyPart.name)
    const resolutionLab = isResolutionLab(stackQuestion.QuestionSet.bodyPart.name)
    dicomFileSetId = stackQuestion.QuestionSet.dicomFileSet
    bodyPartId = stackQuestion.QuestionSet.bodyPartId

    if (!answer.attemptedAnswerIdentifier) {
      stackQuestionResults.push({
        score: 0.0,
        stackQuestion: _.pick(stackQuestion, ['questionText', 'title', 'order', 'id']),
        abandoned: true,
      })
      continue
    }

    let selectedAnswer = _.find(stackQuestion.answers, { id: answer.attemptedAnswerIdentifier })

    let groupScoreVariables, score
    if (answer.groupScoreVariables) {
      groupScoreVariables = answer.groupScoreVariables
      score = answer.score
    } else if (answer.answer) {
      // Only try to determine score if question wasn't skipped
      groupScoreVariables = calculateGroupScoreVariables(
        answer.answer,
        selectedAnswer,
        {
          ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
          isContrastLab: contrastLab,
          isResolutionLab: resolutionLab,
          isCTLab: isCTLab == 1,
          isUltraLab: stackQuestion.QuestionSet.isUltraLab,
          isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
          isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
          questionType: _.get(stackQuestion, 'questionType', -1),
          isPostContrast: stackQuestion.postContrast,
          phaseNum: _.get(stackQuestion, 'phaseNum', 1),
          isProduction,
        },
        undefined,
        { injectionAttribute, weightBasedDoses }
      )
      score = flatScoreFromGroupScoreVariables(groupScoreVariables)
    }

    let stackQuestionResult = {
      score,
      stackQuestion: {
        questionText: stackQuestion.questionText,
        questionType: stackQuestion.questionType,
        postContrast: stackQuestion.postContrast,
        title: stackQuestion.title,
        hdBranchId: stackQuestion.hdBranchId,
        order: stackQuestion.order,
        answers: _.map(stackQuestion.answers, function (answer) {
          return _.pick(answer, 'id', 'name', 'criteria', 'citation')
        }),
        id: stackQuestion.id,
      },
      attemptedAnswerIdentifier: answer.attemptedAnswerIdentifier,
      sliceViews: await serializeSliceViews(answer.sliceViews),
      answerViews: await serializeSliceViews(answer.answerViews),
      skipped: answer.skipped,
      freebie: answer.freebie,
      userAnswers: answer.answer,
      isContrastLab: contrastLab,
      isUltraLab: stackQuestion.QuestionSet.isUltraLab,
      stackQuestionId: stackQuestion.id,
      sliceQuantScores: answer.sliceQuantScores,
      stackQuestionResultId: answer.id,
      userId: _.get(questionSetResult, ['userId']),
      user: _.get(questionSetResult, ['user']),
      skillScores: answer.skillScores,
      stackQuestionResultComments: answer.stackQuestionResultComments,
    }
    stackQuestionResults.push({
      ...stackQuestionResult,
      groupScoreVariables: serializeGroupScoreVariables(groupScoreVariables), // strip data that's too detailed for the user
    })
  }

  stackQuestionResults = _.orderBy(stackQuestionResults, (el) => _.get(el, ['stackQuestion', 'order'], 0))

  let rawCriticalThinkingResults = []
  // Old QuestionSetResults (pre ~Dec 18 2020) don't have testRunIds, so don't just grab all of those when looking up one QSR - it's actually none, cause we have no idea which ones came with them at the time of that test
  if (questionSetResult.testRunId) {
    const multipleChoiceQuestionResultSql =
      QuestionSetResultService.getQueryMultipleChoiceQuestionResultSql(modelProvider)

    rawCriticalThinkingResults = await sequelize.query(multipleChoiceQuestionResultSql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { testRunId: questionSetResult.testRunId },
    })
  }

  // Batch-load media for all CT questions in one query (avoids N+1 getMedia calls)
  const ctQuestionIds = rawCriticalThinkingResults.map((r) => r.questionId)
  const ctMediaMap = await criticalThinkingSvc.batchGetMedia(ctQuestionIds)

  const criticalThinkingResults = await Promise.all(
    rawCriticalThinkingResults.map(
      async ({
        score,
        answer,
        questionId,
        text,
        answerExplanation,
        choices,
        range,
        type,
        screeningForm,
        isBetaQuestion,
        multipleChoiceQuestion,
        ...props
      }) => {
        const media = _.get(ctMediaMap, [questionId, 'preparedMedia'], null)
        return {
          score,
          selectedAnswer: answer,
          questionId,
          text,
          choices,
          range,
          type,
          answerExplanation,
          media,
          screeningForm,
          category: {
            name: multipleChoiceQuestion?.category?.name || null,
          },
          isBetaQuestion,
          multipleChoiceQuestion,
        }
      }
    )
  )

  const regularQuestions = criticalThinkingResults.filter((q) => !q.isBetaQuestion)
  const betaQuestions = criticalThinkingResults.filter((q) => q.isBetaQuestion)

  res.json({
    success: true,
    dicomFileSetId,
    bodyPartId,
    questionSetResult: _.pick(questionSetResult, ['score', 'userId', 'user', 'questionSetId']),
    stackQuestionResults,
    criticalThinkingResults: regularQuestions,
    betaCriticalThinkingResults: betaQuestions,
    overallSkillScores: questionSetResult.overallSkillScores,
  })
})

// Delete
router.delete('/results/review/questionSet/:questionSetResultId', fetchLoggedInUser, async function (req, res) {
  const { questionSetResultId } = req.params
  const userIsAdmin = isAdmin(req.session.user)
  const testRunUserId = req.query.userId

  // TODO should ensure they are the Manager of an appropriate Cohort (that they are the Manager of a Cohort that the Student is associated with via CohortStudents)
  if (await isManagerOrAdmin(req.session.user)) {
    const modelProvider = await ModelProvider.getModelProvider(testRunUserId)
    const questionSetResult = await modelProvider.QuestionSetResult.findByPk(questionSetResultId)
    if (!questionSetResult) {
      res.status(404).json({ success: false })
      return
    }

    const testRunId = questionSetResult.testRunId
    let testRun
    if (testRunId) {
      testRun = await modelProvider.TestRun.findByPk(testRunId)
    }

    if (!userIsAdmin && testRun && parseFloat(testRun.score) > 20) {
      res.status(200).json({ success: false, error: `Test Score ${testRun.score} is too high to delete!` })
    } else if (!userIsAdmin && parseFloat(questionSetResult.score) > 20) {
      res.status(200).json({ success: false, error: `MRI Score ${questionSetResult.score} is too high to delete!` })
    } else {
      await sequelize.transaction(async function (transaction) {
        // Before deleting, get the beta question IDs
        let betaQuestionIds = []
        if (testRunId) {
          const betaResults = await modelProvider.MultipleChoiceQuestionResult.findAll({
            attributes: ['multipleChoiceQuestionId'],
            include: [
              {
                model: MultipleChoiceQuestion,
                as: 'multipleChoiceQuestion',
                where: { isBetaQuestion: true },
                attributes: [],
              },
            ],
            where: { testRunId },
            raw: true,
            transaction,
          })
          betaQuestionIds = betaResults.map((result) => result.multipleChoiceQuestionId)
        }

        // The MRI QuestionSetResult
        await modelProvider.QuestionSetResult.destroy(
          {
            where: {
              id: questionSetResultId,
            },
          },
          { transaction }
        )

        // Before December 2020, QuestionSetResults did not have testRunIds stored
        if (testRunId) {
          // The results for the Critical Thinking Questions
          await modelProvider.MultipleChoiceQuestionResult.destroy(
            {
              where: {
                testRunId,
              },
            },
            { transaction }
          )

          // TestRun itself
          await modelProvider.TestRun.destroy(
            {
              where: {
                id: testRunId,
              },
            },
            { transaction }
          )

          // Decrement betaQuestionAttempts for beta questions
          if (betaQuestionIds.length > 0) {
            await MultipleChoiceQuestion.decrement('betaQuestionAttempts', {
              where: {
                id: { [Op.in]: betaQuestionIds },
                betaQuestionAttempts: { [Op.gt]: 0 }, // Ensure we don't decrement below 0
              },
              transaction,
              individualHooks: false,
            })
          }
        }
      })
      try {
        await statsCacheHelper.invalidateCachesForUser(testRunUserId)
      } catch (err) {
        console.log('Cache invalidation after delete failed', err)
      }
      return res.json({ success: true })
    }
  } else {
    return res.status(403).json({ success: false })
  }
})

module.exports = router
