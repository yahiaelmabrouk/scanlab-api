const _ = require('lodash')
const { v4: uuidv4 } = require('uuid')
const { s3Upload, getS3BucketOfRegion } = require('../api_util/aws')

const { Op } = require('sequelize')
const {
  QuestionSet,
  CohortStudent,
  MultipleChoiceQuestion,
  StackQuestion,
  BodyPart,
  sequelize,
  InjectionAttribute,
  WeightBasedDose,
} = require('../../db/models')
const criticalThinkingSvc = require('./criticalThinkingQuestion.service')
const questionGroupSvc = require('./questionGroup.service')
const patientPrepUtil = require('../api_util/patientPrep.util')
const sliceQuantGradingCTUtil = require('../api_util/sliceQuantGradingCT.util')
const sliceQuantGradingUltraLabUtil = require('../api_util/sliceQuantGradingUltraLab.util')
const sliceQuantGradingMRBasicUtil = require('../api_util/sliceQuantGradingMRBasic.util')
const sliceQuantGradingResolutionUtil = require('../api_util/sliceQuantGradingResolution.util')
const sliceQuantGradingContrastUtil = require('../api_util/sliceQuantGradingContrast.util')
const skillScoresUtil = require('../api_util/skillScores.util')
const skillScoresCTUtil = require('../api_util/skillScoresCT.util')
const skillScoresUltraLabUtil = require('../api_util/skillScoresUltraLab.util')
const skillScoresContrastUtil = require('../api_util/skillScoresContrast.util')
const skillScoresResolutionUtil = require('../api_util/skillScoresResolution.util')
const skillScoresMRBasicUtil = require('../api_util/skillScoresMRBasic.util')
const {
  isContrastLab,
  isResolutionLab,
  serializeSliceViews,
  getMineCohortArea,
  getUserInfomationFromUserModel,
} = require('../api_util/api_util')
const { serializeGroupScoreVariables, calculateGroupScoreVariables } = require('../api_util/score')
const { categoryIds, angioExamBodyPartIds, cardiacBodyPartIds } = require('../../util/constants')
const ModelProvider = require('../providers/model.provider')
const { whereObjectToSql } = require('../../util/sql')

const statsCacheHelper = require('../statsCacheHelper')
const { retryOnSerializationError } = require('../../util/retrySerializable')
const { getCachedWeightBasedDoses } = require('../api_util/middlewareCache')

class NoQuestionSetAvailableError extends Error {
  constructor(bodyPartId) {
    super(`No QuestionSet found for BodyPart with ID: ${bodyPartId}`)
    this.name = 'NoQuestionSetAvailableError'
    this.bodyPartId = bodyPartId
  }
}

function getDefaultAnswerFromStackQuestion(stackQuestion) {
  return _.find(stackQuestion.answers, { default: true }) || _.first(stackQuestion.answers)
}

/* Method takes an array of questions and returns an object with categoryIds and indices
of where each category starts in the supplied array of questions */
function getPointersToCategoryIdStartPos(questions) {
  const questionGroup = questions.reduce(
    (acc, question, index) => {
      if (!_.includes(acc.categoryIds, question.categoryId)) {
        acc.categoryIds.push(question.categoryId)
        acc.indices.push(index)
      }
      return acc
    },
    { categoryIds: [], indices: [] }
  )

  if (questionGroup.categoryIds.includes(categoryIds.anatomy)) {
    const anatomyIndex = questionGroup.categoryIds.indexOf(categoryIds.anatomy)
    questionGroup.categoryIds.splice(anatomyIndex, 1)
    questionGroup.categoryIds.unshift(categoryIds.anatomy)

    const questionIndice = questionGroup.indices[anatomyIndex]
    questionGroup.indices.splice(anatomyIndex, 1)
    questionGroup.indices.unshift(questionIndice)
  }

  return questionGroup
}

// TODO: users should only be able to touch their own tests
const TestSvc = {
  // generate test: pre and post slicing mc questions as well as exam from body part
  // Current Rules:
  // PRE SLICES: Always 1 patient screening question. Relevant to the body part of the exam if possible, otherwise allow a non-body-part specific security question.
  // POST SLICES: 4 questions of any category except patient screening. Relevant to the body part of the exam if available, otherwise allow non-body-part specific questions.
  async generateTestQuestions(userId, cohort, bodyPartId, isCTLab) {
    const modelProvider = await ModelProvider.getModelProvider(userId)
    let postQuestionCount = _.get(cohort, 'adminSettings.amountOfCriticalThinkingQuestionsPerTestRun', 4)

    // We must to get QuestionSet before get other questions
    // get question set
    const createdTestRunsCount = await modelProvider.TestRun.count({
      where: { userId, bodyPartId },
    })
    const abnormalQuestionSets = await QuestionSet.findAll({
      attributes: ['id', 'rarity', 'ageFrom', 'ageTo', 'gender'],
      order: sequelize.random(),
      where: {
        bodyPartId,
        rarity: {
          [Op.ne]: 'common',
        },
        isAvailable: true,
        isPreparedExamOnly: false,
      },
    })
    let questionSet
    if (abnormalQuestionSets.length > 0) {
      let abnormalQuestionSet
      if (createdTestRunsCount % 20 === 19) {
        abnormalQuestionSet = _.find(abnormalQuestionSets, {
          rarity: '1-20',
        })
      }
      if (!abnormalQuestionSet && createdTestRunsCount % 10 === 9) {
        abnormalQuestionSet = _.find(abnormalQuestionSets, {
          rarity: '1-10',
        })
      }
      if (!abnormalQuestionSet && createdTestRunsCount % 5 === 4 && createdTestRunsCount % 15 !== 14) {
        abnormalQuestionSet = _.find(abnormalQuestionSets, {
          rarity: '1-5',
        })
      }
      questionSet = abnormalQuestionSet
    }

    if (!questionSet) {
      const questionSetOfBodyParts = await QuestionSet.findAll({
        attributes: ['id', 'ageFrom', 'ageTo', 'gender'],
        order: sequelize.random(),
        where: {
          bodyPartId,
          isAvailable: true,
          isPreparedExamOnly: false,
          rarity: 'common',
        },
        limit: 1,
      })
      questionSet = _.first(questionSetOfBodyParts)
    }

    if (!questionSet) {
      throw new NoQuestionSetAvailableError(bodyPartId)
    }

    const baseWhereClause = {
      bodyPartId: {
        [Op.or]: [bodyPartId, null],
      },
      categoryId: {
        [Op.notIn]: [categoryIds.cardiac],
      },
    }

    let categoryDifficultyFilter = () => {
      return true
    }

    // Get admin settings for CTQ categories
    const adminCriticalThinkingCategories = _.get(cohort, 'adminSettings.criticalThinkingCategories')
    if (adminCriticalThinkingCategories)
      baseWhereClause.categoryId[Op.notIn].push(
        ...adminCriticalThinkingCategories.filter((c) => c.locked).map((c) => c.id)
      )

    // Default to limiting CTQ based on Cohort-level setting
    let criticalThinkingCategories = _.get(cohort, 'settings.criticalThinkingCategories')
    if (_.get(cohort, 'adminSettings.isIndividualSettingsEnabled')) {
      let cohortStudent = await CohortStudent.findOne({
        where: { userId, cohortId: cohort.id },
      })
      // If set to overwrite, use setting particular to that student
      if (
        _.get(cohortStudent, 'settingsFromManager.overwriteCriticalThinkingCategories') &&
        _.get(cohortStudent, 'settingsFromManager.criticalThinkingCategories')
      ) {
        criticalThinkingCategories = cohortStudent.settingsFromManager.criticalThinkingCategories
      }
    }

    // Consider cohort restrictions
    if (criticalThinkingCategories) {
      baseWhereClause.categoryId[Op.notIn].push(...criticalThinkingCategories.filter((c) => c.locked).map((c) => c.id))
      baseWhereClause.categoryId[Op.notIn] = _.uniq(baseWhereClause.categoryId[Op.notIn])
      categoryDifficultyFilter = (question) => {
        const category = criticalThinkingCategories.find((c) => c.id === question.categoryId)
        if (!category || !_.isFinite(question.difficulty)) {
          return true
          // maxDifficulty may not be set
        } else if (_.isFinite(category.maxDifficulty) && question.difficulty > category.maxDifficulty) {
          return false
          // minDifficulty may not be set
        } else if (_.isFinite(category.minDifficulty) && question.difficulty < category.minDifficulty) {
          return false
        } else {
          return true
        }
      }
    }

    // Is this hacky enough? TODO establish flag for questions to only be available on their region
    const isCardiac = cardiacBodyPartIds.includes(bodyPartId)
    if (isCardiac) {
      baseWhereClause.bodyPartId = {
        [Op.or]: [...cardiacBodyPartIds, null],
      }
      baseWhereClause.categoryId = {
        [Op.in]: [categoryIds.patientScreening, categoryIds.cardiac],
      }
    }

    const isAngio = angioExamBodyPartIds.includes(bodyPartId)

    if (isAngio) {
      baseWhereClause.bodyPartId = {
        [Op.or]: [bodyPartId, null],
      }
      baseWhereClause.categoryId = {
        [Op.in]: [categoryIds.patientScreening, categoryIds.contrastBolus, categoryIds.angiography],
      }
    }

    let baseBodyPartId = bodyPartId
    const bodyPartInfo = await BodyPart.findByPk(bodyPartId)
    let bodyPartAndBodyPartHasBaseIds = []
    if (bodyPartInfo && _.get(bodyPartInfo, ['baseId'])) {
      baseBodyPartId = _.get(bodyPartInfo, ['baseId'])
      bodyPartAndBodyPartHasBaseIds.push(_.get(bodyPartInfo, ['baseId']))
    } else {
      bodyPartAndBodyPartHasBaseIds.push(baseBodyPartId)
    }

    const allBaseIds = await BodyPart.findAll({
      attributes: ['id'],
      where: {
        baseId: baseBodyPartId,
      },
    })

    bodyPartAndBodyPartHasBaseIds.push(...allBaseIds.map((el) => el.id))

    const whereClauseWhenGeneralQuestion = {
      isGeneralQuestion: true,
      categoryId: baseWhereClause.categoryId,
      bodyPartId: {
        [Op.or]: bodyPartAndBodyPartHasBaseIds,
      },
    }

    // Return a list of all multiple choice questions and how many times this user has answered it
    // each item as the following attributes:
    // {
    //   id,
    //   bodyPartId,
    //   categoryId,
    //   difficulty
    //   questionCount
    // }
    const sqlWhereClause = whereObjectToSql(
      {
        [Op.or]: [baseWhereClause, whereClauseWhenGeneralQuestion],
      },
      true
    )
    let allQuestionsWithCounts = await sequelize.query(
      `
        SELECT "MultipleChoiceQuestion"."categoryId",
          "MultipleChoiceQuestion"."bodyPartId",
          "MultipleChoiceQuestion"."difficulty",
          "MultipleChoiceQuestion"."onlyForPreparedExams",
          "MultipleChoiceQuestion"."globalQuestion",
          "MultipleChoiceQuestion"."hideQuestion",
          "MultipleChoiceQuestion"."screeningForm",
          CAST(count(distinct "multipleChoiceQuestionResults"."id") AS INTEGER) + CAST(count(distinct "multipleChoiceQuestionResultsEuWest"."id") AS INTEGER) AS "questionCount",
          "MultipleChoiceQuestion"."id" AS "id"
        FROM "MultipleChoiceQuestions" AS "MultipleChoiceQuestion"
        LEFT OUTER JOIN "MultipleChoiceQuestionResults" AS "multipleChoiceQuestionResults"
          ON "MultipleChoiceQuestion"."id" = "multipleChoiceQuestionResults"."multipleChoiceQuestionId" AND "multipleChoiceQuestionResults"."userId" = :userId
        LEFT OUTER JOIN eu_west_server_public."MultipleChoiceQuestionResults" AS "multipleChoiceQuestionResultsEuWest"
          ON "MultipleChoiceQuestion"."id" = "multipleChoiceQuestionResultsEuWest"."multipleChoiceQuestionId" AND "multipleChoiceQuestionResultsEuWest"."userId" = :userId
          WHERE ${sqlWhereClause}
        GROUP BY "categoryId", "bodyPartId", "difficulty", "MultipleChoiceQuestion"."id"
        ORDER BY "MultipleChoiceQuestion"."categoryId", "questionCount", "MultipleChoiceQuestion"."bodyPartId", RANDOM();
      `,
      {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
        replacements: {
          userId,
          bodyPartId,
        },
      }
    )

    allQuestionsWithCounts = allQuestionsWithCounts.filter(
      (q) => !q.hideQuestion && (q.globalQuestion || !q.onlyForPreparedExams)
    )

    let preQuestionCandidates = []
    let postQuestionCandidates = []

    // screening questions go into "pre", others into "post"
    _.forEach(allQuestionsWithCounts, (q) =>
      q.categoryId === 3 ? preQuestionCandidates.push(q) : postQuestionCandidates.push(q)
    )
    preQuestionCandidates = preQuestionCandidates.filter(categoryDifficultyFilter)
    postQuestionCandidates = postQuestionCandidates.filter(categoryDifficultyFilter)

    // Angio region exams get special MC question categories
    if (isAngio) {
      const contrastBolus = []
      const angioQuestions = []
      for (let q of postQuestionCandidates) {
        if (q.categoryId === categoryIds.contrastBolus) {
          contrastBolus.push(q)
        } else if (q.categoryId === categoryIds.angiography) {
          angioQuestions.push(q)
        }
      }
      postQuestionCandidates = contrastBolus.slice(0, 1).concat(angioQuestions)
    }

    // this will select the least frequently answered questions, and it should have a body part based on the original orderby
    let preQuestion = _.first(preQuestionCandidates)

    if (isCTLab) {
      if (!_.isNil(questionSet.ageFrom) && !_.isNil(questionSet.ageTo) && !_.isNil(questionSet.gender)) {
        const suitablePreQuestionCandidate = preQuestionCandidates.find((el) => {
          const screeningFormAge = _.get(el, ['screeningForm', 'age'], null)
          const screeningFormGender = _.get(el, ['screeningForm', 'gender'], null)

          return (
            screeningFormAge != null &&
            screeningFormGender != null &&
            screeningFormAge >= questionSet.ageFrom &&
            screeningFormAge <= questionSet.ageTo &&
            questionSet.gender == screeningFormGender
          )
        })
        if (suitablePreQuestionCandidate) {
          preQuestion = suitablePreQuestionCandidate
        }
      }
    }

    // get first of each category from the list.
    // based on the original orderBy, this should result in the least answered questions starting with the the ones that have a body part
    let postQuestions = []

    // if questions candidates is less thant the question count, set questions count to number of question candidates
    if (postQuestionCandidates.length < postQuestionCount) {
      postQuestionCount = postQuestionCandidates.length
    }

    if (isCTLab) {
      postQuestionCandidates = _.shuffle(postQuestionCandidates)
    }
    // get pointers to the start of each critical thinking question category
    let categoryStart = getPointersToCategoryIdStartPos(postQuestionCandidates)

    // continuesly add CT questions by looping through the categoryStart indices until question count is reached
    let usedQuestionIds = new Set()
    for (let j = 0; postQuestions.length < postQuestionCount; ) {
      let currentQuestion = postQuestionCandidates[categoryStart.indices[j]]
      if (!usedQuestionIds.has(currentQuestion.id)) {
        postQuestions.push(currentQuestion)
        usedQuestionIds.add(currentQuestion.id)
      }
      categoryStart.indices[j]++
      if (categoryStart.indices[j] >= postQuestionCandidates.length) {
        categoryStart.indices[j] = 0 // Reset to start if end is reached
      }
      j = j == categoryStart.indices.length - 1 ? 0 : ++j // increment pointer or reset to 0
    }

    let questions = []
    if (preQuestion) {
      questions.push({ id: preQuestion.id, type: 'PREQUESTION' })
    }

    questions.push({ id: questionSet.id, type: 'QUESTIONSET' })

    questions = _.concat(
      questions,
      _.map(postQuestions, (q) => {
        return { id: q.id, type: 'POSTQUESTION' }
      })
    )

    return questions
  },

  async generatePreparedExamTestQuestions(preparedExam) {
    const { preTestQuestions, questionSetId, postTestQuestions } = preparedExam.questions
    const questions = []
    _.forEach(preTestQuestions, (q) => questions.push({ id: q.id, type: 'PREQUESTION' }))
    questions.push({ id: questionSetId, type: 'QUESTIONSET' })
    _.forEach(postTestQuestions, (q) => questions.push({ id: q.id, type: 'POSTQUESTION' }))
    return questions
  },

  async startTestRun(
    userId,
    questions,
    cohort,
    bodyPartId,
    isSandbox,
    preparedExamId,
    softwareVendor = null,
    softwareVersion = null
  ) {
    const modelProvider = await ModelProvider.getModelProvider(userId)
    if (!isSandbox && _.get(cohort, 'adminSettings.isSandboxEnabled')) {
      let cohortStudent = await CohortStudent.findOne({
        where: { userId, cohortId: cohort.id },
      })

      if (
        _.get(cohort, 'adminSettings.isIndividualSettingsEnabled') &&
        _.get(cohortStudent, 'settingsFromManager.overwriteBodyPartSettings')
      ) {
        // Use Individual settings overwrite
        isSandbox = _.includes(cohortStudent.settingsFromManager.sandboxedBodyParts, bodyPartId)
      } else if (_.get(cohort, 'settings.sandboxedBodyParts')) {
        // use Cohort settings
        isSandbox = _.includes(cohort.settings.sandboxedBodyParts, bodyPartId)
      }
    }

    const testRun = await modelProvider.TestRun.create({
      userId,
      questions,
      answers: [],
      isSandbox,
      timeStarted: sequelize.literal('now()'),
      preparedExamId,
      bodyPartId,
      softwareVendor,
      softwareVersion,
    })
    const serializedTestRun = _.pick(testRun, [
      'id',
      'questions',
      'answers',
      'timeStarted',
      'isSandbox',
      'preparedExamId',
      'softwareVendor',
      'softwareVersion',
    ])

    const angio = angioExamBodyPartIds.includes(bodyPartId)

    serializedTestRun.angio = angio

    return serializedTestRun
  },

  async getTestRun(testRunId, transaction = null, userId) {
    const modelProvider = await ModelProvider.getModelProvider(userId)
    return await modelProvider.TestRun.findByPk(testRunId, { transaction })
  },

  // User submits answer to a single question of a testRun (either Stack or CriticalThinkingQuestion)
  async addAnswer(testRunId, answer, user) {
    const testRun = await this.getTestRun(testRunId, null, user.id)

    if (!testRun) {
      throw new Error(`TestRun not found: ${testRunId}`)
    } else if (testRun.timeEnded) {
      throw new Error(`TestRun already ended: ${testRunId}`)
    }

    let testRunQuestion = _.find(testRun.questions, {
      id: answer.questionId || answer.questionSetId,
    })
    if (!testRunQuestion) {
      throw new Error('Answer must correspond to an available question')
    }

    // Ensure that all the answers picked for MultipleChoiceQuestions are part of the choices in the question
    // Pre/Post questions are always potentially MultipleChoice
    if (_.includes(['PREQUESTION', 'POSTQUESTION'], testRunQuestion.type)) {
      let multipleChoiceQuestionDB = await MultipleChoiceQuestion.findByPk(answer.questionId)
      // MultipleChoice (not timed video)
      if (
        multipleChoiceQuestionDB &&
        (multipleChoiceQuestionDB.type === 'MC' || multipleChoiceQuestionDB.type === 'SF')
      ) {
        // array of answerIds
        let pickedAnswerIds = _.split(answer.selectedAnswer, ',')
        let everyPickedAnswerIdIsAChoice = _.every(pickedAnswerIds, function (pickedAnswerId) {
          return _.some(multipleChoiceQuestionDB.choices, { id: pickedAnswerId })
        })
        if (!everyPickedAnswerIdIsAChoice) {
          throw new Error('Picked answer(s) not part of this question')
        }
      }
    }

    // Remember the user's preference for which Answer Criteria they like to be graded on for this StackQuestion
    if (answer.stackQuestionId && answer.answerSelectionId) {
      let stackQuestion = await StackQuestion.findByPk(answer.stackQuestionId)
      const userInformation = getUserInfomationFromUserModel(user)

      let preferredAnswerCriteriaByStackQuestionId = userInformation.preferredAnswerCriteriaByStackQuestionId || {}
      // Only persist this choice if it's not the default/only choice
      if (getDefaultAnswerFromStackQuestion(stackQuestion).id !== answer.answerSelectionId) {
        preferredAnswerCriteriaByStackQuestionId[answer.stackQuestionId] = answer.answerSelectionId
      } else {
        // Ensure nothing else is stored / store the fact that we want the default by not storing anything
        delete preferredAnswerCriteriaByStackQuestionId[answer.stackQuestionId]
      }
      userInformation.preferredAnswerCriteriaByStackQuestionId = preferredAnswerCriteriaByStackQuestionId
      await retryOnSerializationError(() => userInformation.save(), {
        label: `addAnswer preferredCriteria (user ${user.id})`,
      })
    }

    // Remember the user's preferred timing method for CT timing decision questions
    if (answer.selectedTimingMethod) {
      const userInformation = getUserInfomationFromUserModel(user)
      userInformation.preferredTimingMethod = answer.selectedTimingMethod
      await retryOnSerializationError(() => userInformation.save(), {
        label: `addAnswer preferredTimingMethod (user ${user.id})`,
      })
    }

    // If user already submitted an answer for this Stack/Multi Question, replace it; else add it
    let answers = testRun.answers
    let existingAnswer = _.find(answers, _.pick(answer, ['questionId', 'stackQuestionId']))
    // upload answer's base64 images to s3
    answer = await this.uploadAnswerImages(testRun, answer)
    if (existingAnswer) {
      // Answer already existed, replacing...
      Object.assign(existingAnswer, answer)
    } else {
      // Answer new, adding...
      answers = _.concat(testRun.answers, answer)
    }

    await testRun.update({ answers })

    return testRun
  },

  // User submits answer to a single question of a testRun (either Stack or CriticalThinkingQuestion)
  // user must be an user model object, not a plain object
  async addMultiAnswers(testRunId, answers, user) {
    const testRun = await this.getTestRun(testRunId, null, user.id)

    if (!testRun) {
      throw new Error(`TestRun not found: ${testRunId}`)
    } else if (testRun.timeEnded) {
      throw new Error(`TestRun already ended: ${testRunId}`)
    }

    let testRunAnswers = testRun.answers

    // --- Batch-load all required questions in a single round-trip each ---
    // Collect the distinct IDs we actually need before hitting the DB.
    const mcQuestionIds = _.uniq(answers.map((a) => a.questionId).filter(Boolean))
    const stackQuestionIds = _.uniq(answers.map((a) => a.stackQuestionId).filter(Boolean))

    const [mcQuestionRows, stackQuestionRows] = await Promise.all([
      mcQuestionIds.length
        ? MultipleChoiceQuestion.findAll({ where: { id: { [Op.in]: mcQuestionIds } } })
        : Promise.resolve([]),
      stackQuestionIds.length
        ? StackQuestion.findAll({ where: { id: { [Op.in]: stackQuestionIds } } })
        : Promise.resolve([]),
    ])

    const mcQuestionMap = _.keyBy(mcQuestionRows, 'id')
    const stackQuestionMap = _.keyBy(stackQuestionRows, 'id')

    // --- Validate all answers synchronously using the in-memory maps ---
    // Accumulate user-preference changes so we only call save() once.
    const userInformation = getUserInfomationFromUserModel(user)
    let preferredAnswerCriteriaByStackQuestionId = userInformation.preferredAnswerCriteriaByStackQuestionId || {}
    let userInfoDirty = false

    for (const answer of answers) {
      // If user already submitted an answer for this Stack/Multi Question, replace it; else add it
      const testRunQuestion = _.find(testRun.questions, {
        id: answer.questionId || answer.questionSetId,
      })
      if (!testRunQuestion) {
        throw new Error('Answer must correspond to an available question')
      }

      // Ensure that all the answers picked for MultipleChoiceQuestions are part of the choices in the question
      // Pre/Post questions are always potentially MultipleChoice
      if (_.includes(['PREQUESTION', 'POSTQUESTION'], testRunQuestion.type)) {
        const multipleChoiceQuestionDB = mcQuestionMap[answer.questionId]
        // MultipleChoice (not timed video)
        if (
          multipleChoiceQuestionDB &&
          (multipleChoiceQuestionDB.type === 'MC' || multipleChoiceQuestionDB.type === 'SF')
        ) {
          // array of answerIds
          const pickedAnswerIds = _.split(answer.selectedAnswer, ',')
          const everyPickedAnswerIdIsAChoice = _.every(pickedAnswerIds, (pickedAnswerId) =>
            _.some(multipleChoiceQuestionDB.choices, { id: pickedAnswerId })
          )
          if (!everyPickedAnswerIdIsAChoice) {
            throw new Error('Picked answer(s) not part of this question')
          }
        }
      }

      // Remember the user's preference for which Answer Criteria they like to be graded on for this StackQuestion
      if (answer.stackQuestionId && answer.answerSelectionId) {
        const stackQuestion = stackQuestionMap[answer.stackQuestionId]
        if (stackQuestion) {
          // Only persist this choice if it's not the default/only choice
          if (getDefaultAnswerFromStackQuestion(stackQuestion).id !== answer.answerSelectionId) {
            preferredAnswerCriteriaByStackQuestionId[answer.stackQuestionId] = answer.answerSelectionId
          } else {
            // Ensure nothing else is stored / store the fact that we want the default by not storing anything
            delete preferredAnswerCriteriaByStackQuestionId[answer.stackQuestionId]
          }
          userInfoDirty = true
        }
      }

      // Remember the user's preferred timing method
      if (answer.selectedTimingMethod) {
        userInformation.preferredTimingMethod = answer.selectedTimingMethod
        userInfoDirty = true
      }
    }

    // Flush the user-preference update once for the whole batch (was one save() per answer before)
    if (userInfoDirty) {
      userInformation.preferredAnswerCriteriaByStackQuestionId = preferredAnswerCriteriaByStackQuestionId
      await retryOnSerializationError(() => userInformation.save(), {
        label: `addMultiAnswers preferredCriteria (user ${user.id})`,
      })
    }

    // --- Parallelize all S3 image uploads across every answer simultaneously ---
    const uploadedAnswers = await Promise.all(answers.map((answer) => this.uploadAnswerImages(testRun, answer)))

    // --- Merge uploaded answers into testRunAnswers ---
    for (const answer of uploadedAnswers) {
      const existingAnswer = _.find(testRunAnswers, _.pick(answer, ['questionId', 'stackQuestionId']))
      if (existingAnswer) {
        // Answer already existed, replacing...
        Object.assign(existingAnswer, answer)
      } else {
        // Answer new, adding...
        testRunAnswers = _.concat(testRunAnswers, answer)
      }
    }

    await testRun.update({ answers: testRunAnswers })

    return testRun
  },
  // With user in A region, you must upload the user data to the A region S3 bucket
  async uploadAnswerImages(testRun, answer) {
    try {
      const cohortArea = await getMineCohortArea(testRun.userId)
      const bucket = getS3BucketOfRegion(cohortArea)
      const handle = async (slice) => {
        if (_.startsWith(slice.src, 'data:image')) {
          const b64 = slice.src.replace(/^data:image\/\w+;base64,/, '')
          // sanity check
          if (b64.length > 15_000_000) throw new Error('Image too large for upload')
          const buf = Buffer.from(b64, 'base64')
          const envPath = process.env.NODE_ENV ?? 'development'
          slice.pathKey = `test-scans/${envPath}/${testRun.id}/${answer.stackQuestionId}/${slice.id}_${uuidv4()}.jpg`
          slice.bucket = bucket
          await s3Upload(bucket, slice.pathKey, buf, 'image/jpeg')
          delete slice.src
        }
        return slice
      }
      if (_.has(answer, 'sliceViews')) await Promise.all(answer.sliceViews.map(handle))
      if (_.has(answer, 'answerViews')) await Promise.all(answer.answerViews.map(handle))
      return answer
    } catch (e) {
      // add context then rethrow
      e.message = `uploadAnswerImages failed: ${e.message}`
      throw e
    }
  },

  async submitTestRun(
    testRunId,
    secondsActive,
    completionTimestamp,
    allowResubmit,
    isChallengeMode = false,
    useTransaction = null,
    isCTLab = false,
    isProduction = false,
    userId = null
  ) {
    const modelProvider = await ModelProvider.getModelProvider(userId)

    // ── Phase 1: Reads & validation (outside transaction) ──────────────────
    // Fetching data before the transaction keeps the DB connection open for
    // the minimum time — only actual writes need to hold it.
    const testRun = await this.getTestRun(testRunId, null, userId)

    if (testRun.timeEnded && !allowResubmit) {
      throw new Error('May not resubmit a test')
    }

    const questionSetId = _.find(testRun.questions, { type: 'QUESTIONSET' }).id
    const stackQuestionAnswers = _.filter(testRun.answers, { questionSetId })
    const criticalThinkingAnswers = _.filter(testRun.answers, (a) => a.questionId)

    // Fetch stackQuestions and weightBasedDoses in parallel (both reads, no transaction needed)
    const [stackQuestions, weightBasedDoses] = await Promise.all([
      StackQuestion.findAll({
        where: {
          questionSet: questionSetId,
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
                      'posts',
                      'maxTime',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      // PERF: use in-memory cache – avoids a full-table scan on every test submission
      getCachedWeightBasedDoses(WeightBasedDose),
    ])

    const isUltraLab = stackQuestions.reduce((acc, q) => acc || q.QuestionSet.isUltraLab, false)

    // ── Phase 2: CPU-bound score calculations (outside transaction) ─────────
    // THREE.js Vector3 math inside calculateGroupScoreVariables (new
    // THREE.Vector3, cross-product chains, etc.) blocks the event loop for
    // 300-500 ms per exam. Running it before the transaction ensures the DB
    // connection is never held open while the CPU is busy.
    const precomputedAnswerScores = []
    for (const answer of stackQuestionAnswers) {
      let stackQuestion = _.find(stackQuestions, { id: answer.stackQuestionId })
      let selectedAnswer = _.find(stackQuestion.answers, { id: answer.answerSelectionId })

      const contrastLab = isContrastLab(stackQuestion.QuestionSet.bodyPart.name)
      const resolutionLab = isResolutionLab(stackQuestion.QuestionSet.bodyPart.name)

      const injectionAttribute = _.get(stackQuestion, ['QuestionSet', 'bodyPart', 'injectionAttributes', 0], null)

      // these contains all the data for scoring/user feedback
      let score = null
      let groupScoreVariables = null
      const skipped = answer.skipped
      let sliceQuantScore = null
      let skillScores = null

      //need to ignore these as patient prep is graded on it's own (see above)
      let overrides = isCTLab
        ? {
            factors: {
              isScanPositionRight: { scoring: { maximumPointLoss: 0 } },
              landmarkDistanceRatio: { scoring: { maximumPointLoss: 0 } },
              injectionContrastValue: {
                scoringTooHigh: { maximumPointLoss: 0 },
                scoringTooLow: { maximumPointLoss: 0 },
              },
              injectionSalineValue: {
                scoringTooHigh: { maximumPointLoss: 0 },
                scoringTooLow: { maximumPointLoss: 0 },
              },
              landmarkDistanceAP: {
                scoringTooHigh: { maximumPointLoss: 0 },
                scoringTooLow: { maximumPointLoss: 0 },
              },
              landmarkDistanceSI: {
                scoringTooHigh: { maximumPointLoss: 0 },
                scoringTooLow: { maximumPointLoss: 0 },
              },
            },
          }
        : {
            factors: {
              isSatBandIntersectWithSatBandMarkZone: {
                ignore: false,
              },
              intersectSatbandZoneDistance: {
                ignore: false,
              },
            },
          }
      const attributes = { injectionAttribute, weightBasedDoses }
      if (!skipped) {
        const groupScoreCalculation = calculateGroupScoreVariables(
          answer.variables,
          selectedAnswer,
          {
            ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
            isContrastLab: contrastLab,
            isResolutionLab: resolutionLab,
            isCTLab: isCTLab,
            isUltraLab: stackQuestion.QuestionSet.isUltraLab,
            isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
            isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
            questionType: _.get(stackQuestion, 'questionType', -1),
            isPostContrast: stackQuestion.postContrast,
            phaseNum: _.get(stackQuestion, 'phaseNum', 1),
            isProduction,
          },
          overrides,
          attributes
        )
        groupScoreVariables = groupScoreCalculation.groupScoreVariables
        score = groupScoreCalculation.score

        //new score breakdown logic. Old scoring stays in place for backwards compatibility (mainly for UI)
        if (isCTLab) {
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
            overrides,
            attributes
          )
          skillScores = skillScoresCTUtil.calculateScores(sliceQuantScore, {
            isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
            isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
            questionType: _.get(stackQuestion, 'questionType', -1),
            isPostContrast: stackQuestion.postContrast,
            phaseNum: _.get(stackQuestion, 'phaseNum', 1),
            isCta: stackQuestion.QuestionSet?.bodyPart?.name?.toUpperCase().includes('CTA') ?? false,
            isProduction,
          })
        } else if (stackQuestion.QuestionSet.isUltraLab) {
          sliceQuantScore = sliceQuantGradingUltraLabUtil.calculateScores(
            answer.variables,
            selectedAnswer,
            {
              ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
              isContrastLab: contrastLab,
              isResolutionLab: resolutionLab,
              isUltraLab: stackQuestion.QuestionSet.isUltraLab,
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
            overrides,
            attributes
          )
          skillScores = skillScoresUltraLabUtil.calculateScores(sliceQuantScore, {
            dontGradeEfficiency: stackQuestion.dontGradeEfficiency,
            dontGradePixelShift: stackQuestion.dontGradePixelShift,
            hasSpecialtyOptions: stackQuestion.hasSpecialtyOptions,
            gradeContats: stackQuestion.gradeContats,
          })
        } else if (contrastLab) {
          sliceQuantScore = sliceQuantGradingContrastUtil.calculateScores(
            answer.variables,
            selectedAnswer,
            {
              ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
              isContrastLab: contrastLab,
              isResolutionLab: resolutionLab,
              isUltraLab: stackQuestion.QuestionSet.isUltraLab,
              isCTLab: isCTLab == 1,
              isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
              isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
              questionType: _.get(stackQuestion, 'questionType', -1),
              isPostContrast: stackQuestion.postContrast,
              phaseNum: _.get(stackQuestion, 'phaseNum', 1),
              isProduction,
            },
            overrides,
            attributes
          )
          skillScores = skillScoresContrastUtil.calculateScores(sliceQuantScore)
        } else if (resolutionLab) {
          sliceQuantScore = sliceQuantGradingResolutionUtil.calculateScores(
            answer.variables,
            selectedAnswer,
            {
              ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
              isContrastLab: contrastLab,
              isResolutionLab: resolutionLab,
              isUltraLab: stackQuestion.QuestionSet.isUltraLab,
              isCTLab: isCTLab == 1,
              isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
              isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
              questionType: _.get(stackQuestion, 'questionType', -1),
              isPostContrast: stackQuestion.postContrast,
              phaseNum: _.get(stackQuestion, 'phaseNum', 1),
              isProduction,
            },
            overrides,
            attributes
          )
          skillScores = skillScoresResolutionUtil.calculateScores(sliceQuantScore)
        } else if (!resolutionLab && !contrastLab && !isCTLab && !stackQuestion.QuestionSet.isUltraLab) {
          sliceQuantScore = sliceQuantGradingMRBasicUtil.calculateScores(
            answer.variables,
            selectedAnswer,
            {
              ignoreInPlaneRotation: stackQuestion.ignoreInPlaneRotation,
              isContrastLab: contrastLab,
              isResolutionLab: resolutionLab,
              isUltraLab: stackQuestion.QuestionSet.isUltraLab,
              isCTLab: isCTLab == 1,
              isReconQuestion: _.get(stackQuestion, 'questionType', -1) === 2,
              isAcqQuestion: _.get(stackQuestion, 'questionType', -1) === 1,
              questionType: _.get(stackQuestion, 'questionType', -1),
              isPostContrast: stackQuestion.postContrast,
              phaseNum: _.get(stackQuestion, 'phaseNum', 1),
              isProduction,
            },
            overrides,
            attributes
          )
          skillScores = skillScoresMRBasicUtil.calculateScores(sliceQuantScore)
        }
      }

      precomputedAnswerScores.push({
        answer,
        stackQuestion,
        contrastLab,
        score,
        groupScoreVariables,
        sliceQuantScore,
        skillScores,
        skipped,
      })
    }

    // Patient prep scoring is also CPU-bound (calls calculateGroupScoreVariables
    // internally). Compute it here, outside the transaction.
    // Derive reposition question IDs from stackQuestions directly, instead of
    // from the partially-built stackQuestionResults that used to exist only
    // inside the transaction.
    let patientPrepScores = isCTLab ? { scores: [], combinedScore: 0 } : undefined
    if (isCTLab && stackQuestionAnswers.length > 0) {
      let patientPrepAnswers = []
      // Since initial patient prep factors are mixed in with question set answers, we need to
      // pull them out of one of the questions and grade them by (I know, its hacky at best)
      patientPrepAnswers.push(stackQuestionAnswers[0])
      // Get patient prep results from any reposition questions (questionType === 4)
      let repositionQuestionIds = stackQuestions.filter((q) => q.questionType === 4).map((q) => q.id)

      if (repositionQuestionIds.length > 0)
        patientPrepAnswers.push(
          ...stackQuestionAnswers.filter((a) => _.includes(repositionQuestionIds, a.stackQuestionId))
        )

      patientPrepScores = await patientPrepUtil.calculateScores(
        patientPrepAnswers.map((a) => {
          let answer = a
          let stackQuestion = _.find(stackQuestions, { id: a.stackQuestionId })
          let selectedAnswer = _.find(stackQuestion.answers, { id: a.answerSelectionId })
          let injectionAttribute = _.get(stackQuestion, ['QuestionSet', 'bodyPart', 'injectionAttributes', 0], null)
          let hasContrast = stackQuestions.some((q) => q.dataValues.postContrast == true)
          let isContrastOnly = a.variables[0].testInjectionMode == 1

          return {
            answer: answer,
            stackQuestion: stackQuestion,
            selectedAnswer: selectedAnswer,
            attributes: { injectionAttribute, weightBasedDoses },
            hasContrast: hasContrast,
            isContrastOnly: isContrastOnly,
          }
        })
      )
    }

    // ── Phase 3: DB writes only (transaction) ──────────────────────────────
    // All CPU-bound scoring is done; the transaction now holds the DB
    // connection only for the time strictly needed to write results.
    return await sequelize.transaction(async (trans) => {
      const transaction = useTransaction || trans

      let questionSetResult = {
        userId,
        questionSetId,
        testRunId,
        createdAt: completionTimestamp,
        isChallengeMode,
      }
      // removed check for sandbox so that question result set should be created.
      questionSetResult = await modelProvider.QuestionSetResult.create(questionSetResult, { transaction })

      // grade the stack questions
      // started with abandoned
      // TODO: This grading should be done in its own service
      let stackQuestionResults = []
      // removed isSandbox check so it should work for sandbox examtest as well
      stackQuestionResults = await Promise.all(
        stackQuestions.map(async (q) => {
          if (!_.some(testRun.answers, (a) => a.stackQuestionId === q.id)) {
            // abandoned stack question
            let stackQuestionResult = await modelProvider.StackQuestionResult.create(
              {
                score: 0.0,
                sliceQuantScores: { combinedScore: 0.0 },
                skillScores: {},
                questionSetResultId: questionSetResult.id,
                stackQuestionId: q.id,
                attemptedAnswerIdentifier: null,
                answer: null,
                createdAt: completionTimestamp,
              },
              { transaction }
            )

            return {
              ..._.pick(stackQuestionResult, [
                'attemptedAnswerIdentifier',
                'score',
                'sliceQuantScores',
                'skillScores',
                'stackQuestionId',
                'freebie',
              ]),
              questionType: q.questionType,
              stackQuestion: {
                questionText: q.questionText,
                order: q.order,
                answers: _.map(q.answers, function (answer) {
                  return _.pick(answer, 'id', 'name', 'criteria', 'citation')
                }),
              },
            }
          }
        })
      )
      stackQuestionResults = _.compact(stackQuestionResults)

      // Persist each pre-computed answer score as a StackQuestionResult row.
      // All THREE.js scoring math was already done in Phase 2 above; this loop
      // contains only DB writes.
      for (const computed of precomputedAnswerScores) {
        const {
          answer,
          stackQuestion,
          contrastLab,
          score,
          groupScoreVariables,
          sliceQuantScore,
          skillScores,
          skipped,
        } = computed

        let stackQuestionResult = {
          score,
          questionSetResultId: questionSetResult.id,
          stackQuestionId: answer.stackQuestionId,
          attemptedAnswerIdentifier: answer.answerSelectionId,
          answer: !skipped ? answer.variables : null,
          sliceViews: !skipped ? answer.sliceViews : null,
          groupScoreVariables,
          createdAt: completionTimestamp,
          skipped,
          freebie: stackQuestion.freebie,
          answerViews: !skipped ? answer.answerViews : null,
          sliceQuantScores: !skipped ? sliceQuantScore : null,
          skillScores: !skipped ? skillScores : null,
        }
        // Removed sandbox check so that question result should be created to show.
        stackQuestionResult = await modelProvider.StackQuestionResult.create(stackQuestionResult, { transaction })

        stackQuestionResults.push({
          ..._.pick(stackQuestionResult, [
            'attemptedAnswerIdentifier',
            'score',
            'stackQuestionId',
            'sliceViews',
            'skipped',
            'freebie',
            'answerViews',
            'sliceQuantScores',
            'skillScores',
          ]),
          groupScoreVariables: serializeGroupScoreVariables(groupScoreVariables), // strip data that's too detailed for the user
          userAnswers: stackQuestionResult.answer,
          questionType: stackQuestion.questionType,
          isContrastLab: contrastLab,
          stackQuestion: {
            questionText: stackQuestion.questionText,
            order: stackQuestion.order,
            answers: _.map(stackQuestion.answers, function (answer) {
              return _.pick(answer, 'id', 'name', 'criteria', 'citation')
            }),
          },
        })
      }

      // Ensure all elements have stackQuestion and order properties
      stackQuestionResults = stackQuestionResults.filter((el) => _.has(el, 'stackQuestion.order'))

      stackQuestionResults = _.orderBy(stackQuestionResults, (el) => _.get(el, ['stackQuestion', 'order'], 0))

      // grade the critical thinking questions
      let { criticalThinkingResults } = await criticalThinkingSvc.gradeUserAnswers(
        criticalThinkingAnswers,
        testRun,
        completionTimestamp,
        transaction
      )

      // patientPrepScores was computed in Phase 2 above (outside the transaction)

      let skippedFilteredStackQuestions = stackQuestionResults.filter((q) => !q.freebie)

      // If CT Test, Remove Localizer question until localizer grading is available.
      // This will be removed once localizer grading is available
      // TEMP: questionType == 5 is Timing Decision Question, now We don't grade it
      if (isCTLab) {
        skippedFilteredStackQuestions = skippedFilteredStackQuestions.filter(
          (q) => q.questionType && q.questionType !== 3 && q.questionType !== 4 && q.questionType !== 5
        )
      }

      // MRI Score: avg of the MRI question result scores
      questionSetResult.score =
        skippedFilteredStackQuestions.length > 0
          ? _.round(
              _.meanBy(skippedFilteredStackQuestions, (a) => _.toNumber(a.score)),
              2
            )
          : 0.0

      // CT Score: avg of the CT question result scores from sliceQuant values
      questionSetResult.sliceQuantScore =
        skippedFilteredStackQuestions.length > 0
          ? _.round(
              _.meanBy(skippedFilteredStackQuestions, (a) => _.toNumber(a.sliceQuantScores?.combinedScore)),
              2
            )
          : 0.0

      if (isCTLab) {
        questionSetResult.overallSkillScores = skillScoresUtil.calculateOverallSkillScoresForExamCT(
          skippedFilteredStackQuestions.map((q) => q.skillScores),
          patientPrepScores,
          criticalThinkingResults.find((q) => q.type === 'SF')
        )
      } else {
        questionSetResult.overallSkillScores = skillScoresUtil.calculateOverallSkillScoresForExam(
          skippedFilteredStackQuestions.map((q) => q.skillScores)
        )
      }

      // Removed sandbox check so that all changes should be saved
      await questionSetResult.save({ transaction })

      // ScanLab Score is just MRI score if there aren't any CTQs on this testRun
      let combinedScore = questionSetResult.score
      if (_.size(criticalThinkingResults) > 0) {
        if (isCTLab && stackQuestionAnswers) {
          // split out patient screening and CTQ
          let patientScreening = criticalThinkingResults.find((q) => q.type === 'SF')
          let ctqScore =
            _.meanBy(
              _.filter(criticalThinkingResults, (q) => q.type !== 'SF'),
              'score'
            ) || 0
          let stackQuestionScore =
            questionSetResult.sliceQuantScore == 0.0 ? questionSetResult.score : questionSetResult.sliceQuantScore
          if (patientScreening) {
            combinedScore =
              stackQuestionScore * 0.5 +
              patientScreening.score * 0.1 +
              ctqScore * 0.2 +
              patientPrepScores?.combinedScore * 0.2
          } else {
            combinedScore = stackQuestionScore * 0.5 + ctqScore * 0.25 + patientPrepScores?.combinedScore * 0.25
          }
        } else if (isUltraLab && stackQuestionAnswers) {
          // the above if statement needs to be switched to
          // } else if (stackQuestionAnswers) {
          // CTQ Score: avg of all the critical thinking results (|| 0 is needed when abandoning testrun)
          let criticalThinkingScore = _.meanBy(criticalThinkingResults, 'score') || 0

          // the "Scanlab" score, weighted combination of MRI questions and CTQs
          combinedScore = questionSetResult.sliceQuantScore * 0.75 + criticalThinkingScore * 0.25
        } else {
          // CTQ Score: avg of all the critical thinking results (|| 0 is needed when abandoning testrun)
          let criticalThinkingScore = _.meanBy(criticalThinkingResults, 'score') || 0
          // the "Scanlab" score, weighted combination of MRI questions and CTQs
          combinedScore = questionSetResult.sliceQuantScore * 0.75 + criticalThinkingScore * 0.25
        }
      }

      if (isCTLab) {
        await testRun.update(
          {
            timeEnded: completionTimestamp,
            secondsActive: secondsActive,
            score: combinedScore || 0,
            patientPrepScore: patientPrepScores?.combinedScore,
            patientPrepScores,
            questionSetScore: questionSetResult?.sliceQuantScore,
          },
          { transaction }
        )
      } else {
        await testRun.update(
          {
            timeEnded: completionTimestamp,
            secondsActive: secondsActive,
            score: combinedScore || 0,
            questionSetScore: questionSetResult?.sliceQuantScore,
          },
          { transaction }
        )
      }

      // must reload to get an accurate time, as timestamps are calculated at the DB level
      await testRun.reload({ transaction })

      const secondsTotal = Math.round((testRun.timeEnded - testRun.timeStarted) / 1000)
      if (secondsActive > secondsTotal) {
        await testRun.update(
          {
            secondsActive: secondsTotal, // this must be an integer (no decimal places)
          },
          { transaction }
        )
      }

      return {
        testRun,
        success: true,
        results: {
          questionSetResult: _.pick(questionSetResult, ['score', 'userId', 'overallSkillScores']),
          stackQuestionResults: await Promise.all(_.map(stackQuestionResults, async function (stackQuestionResult) {
            return Object.assign({}, stackQuestionResult, {
              sliceViews: await serializeSliceViews(stackQuestionResult.sliceViews),
              answerViews: await serializeSliceViews(stackQuestionResult.answerViews),
              sliceQuantScores: stackQuestionResult.sliceQuantScores,
            })
          })),
          criticalThinkingResults,
        },
        isChallengeMode,
      }
    })
  },

  async regrade(testRunId, transaction = null, isCTLab = false, isProduction = false, userId = null) {
    return await sequelize.transaction(async (trans) => {
      const useTransaction = transaction || trans
      const testRun = await this.getTestRun(testRunId, useTransaction)
      const modelProvider = await ModelProvider.getModelProvider(userId)

      // genocide all children of the test run
      modelProvider.QuestionSetResult.destroy(
        {
          where: {
            testRunId,
          },
        },
        { useTransaction }
      )
      modelProvider.MultipleChoiceQuestionResult.destroy(
        {
          where: {
            testRunId,
          },
        },
        { useTransaction }
      )

      let testRunResults = await this.submitTestRun(
        testRun.id,
        testRun.secondsActive,
        testRun.timeEnded,
        true,
        null,
        useTransaction,
        isCTLab,
        isProduction,
        userId
      )

      // >>> mark this user's cache rows as dirty so next read will rebuild
      await statsCacheHelper.flagCachesDirtyAfterSubmission(userId, testRunResults.isChallengeMode, null)
    })
  },

  /* This begins the logic for dynamically generated prepared exam */

  async generatePreparedExamTestQuestionsDynamically(preparedExam, userId) {
    const { bodyPartId, postQuestionCount, postQuestionBodyPartCount, preQuestionGroupId, postQuestionGroupId } =
      preparedExam
    const { questionSetId } = preparedExam.questions

    const questions = []

    // Get user's completed prepared exam count for rotation in question selection
    const userExamCount = await sequelize.query(
      `SELECT COUNT(*) as count
       FROM "TestRuns"
       WHERE "userId" = :userId
         AND "preparedExamId" IS NOT NULL
         AND "timeEnded" IS NOT NULL`,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { userId },
      }
    )
    const completedExamCount = parseInt(userExamCount[0].count, 10)

    const preTestQuestions = await this.generatePreparedExamPreQuestions(userId, bodyPartId, preQuestionGroupId)
    const postTestQuestions = await this.generatePreparedExamPostQuestions(
      userId,
      bodyPartId,
      postQuestionCount,
      postQuestionBodyPartCount,
      postQuestionGroupId,
      completedExamCount
    )
    const betaQuestion = await this.getBetaQuestion(userId, bodyPartId)

    _.forEach(preTestQuestions, (q) => questions.push({ id: q.id, type: 'PREQUESTION' }))
    questions.push({ id: questionSetId, type: 'QUESTIONSET' })

    const allPostQuestions = [...postTestQuestions]
    if (betaQuestion) {
      allPostQuestions.push(betaQuestion)
    }

    _.forEach(_.shuffle(allPostQuestions), (q) =>
      questions.push({
        id: q.id,
        type: q.isBetaQuestion ? 'BETAQUESTION' : 'POSTQUESTION',
      })
    )

    return questions
  },

  async getBetaQuestion(userId, bodyPartId) {
    const betaQuestions = await this.getPreparedExamQuestionsByUserAndBodyPart(userId, bodyPartId, 'beta')
    if (betaQuestions.length > 0) {
      const selectedBetaQuestion = betaQuestions[0]
      return selectedBetaQuestion
    }
    return null // Return null if no beta questions are available
  },

  async generatePreparedExamPreQuestions(userId, bodyPartId, preQuestionGroupId) {
    const preTestQuestions = await this.getPreparedExamQuestionsByUserAndBodyPart(
      userId,
      bodyPartId,
      'pre',
      preQuestionGroupId
    )
    return preTestQuestions.length > 0 ? [preTestQuestions[0]] : preTestQuestions
  },

  async generatePreparedExamPostQuestions(
    userId,
    bodyPartId,
    postQuestionCount,
    postQuestionBodyPartCount,
    postQuestionGroupId,
    userExamCount
  ) {
    // Generate random seed for question variation on each attempt
    const randomSeed = Math.floor(Math.random() * 1000)

    const questionResults = await this.getPreparedExamQuestionsByUserAndBodyPart(
      userId,
      bodyPartId,
      'post',
      postQuestionGroupId
    )

    // Separate questions: body-part-specific (any non-null bodyPartId) vs general (null bodyPartId)
    let bodyPartQuestions = questionResults.filter((q) => q.bodyPartId != null)
    let otherQuestions = questionResults.filter((q) => q.bodyPartId == null)

    // Group questions by category for each type
    const groupByCategoryAndTimesTaken = (questions) => {
      // First group by category
      const groupedByCategory = _.groupBy(questions, 'categoryId')

      // For each category, group further by times_taken (as a number)
      return _.mapValues(groupedByCategory, (categoryQuestions) => {
        return _.groupBy(categoryQuestions, (q) => parseInt(q.times_taken, 10))
      })
    }

    const bodyPartQuestionsByCategory = groupByCategoryAndTimesTaken(bodyPartQuestions)
    const otherQuestionsByCategory = groupByCategoryAndTimesTaken(otherQuestions)

    // Select questions prioritizing lowest times_taken across all categories
    const selectQuestionsGlobalPriority = (questionsByCategory, count, userId, userExamCount) => {
      const selected = []

      // Get all unique times_taken values across all categories and sort numerically
      const allTimesTaken = new Set()

      Object.values(questionsByCategory).forEach((categoryGroup) => {
        Object.keys(categoryGroup).forEach((timesTaken) => {
          allTimesTaken.add(parseInt(timesTaken, 10))
        })
      })

      const timesTakenValues = Array.from(allTimesTaken).sort((a, b) => a - b)

      // For each times_taken value, cycle through categories and select questions
      for (const timesTaken of timesTakenValues) {
        if (selected.length >= count) break

        // Get list of categories that have questions with current times_taken
        const categoriesWithTime = Object.keys(questionsByCategory).filter(
          (category) =>
            questionsByCategory[category][timesTaken] && questionsByCategory[category][timesTaken].length > 0
        )

        // Sort categories numerically, then rotate for fair distribution
        const sortedCategories = categoriesWithTime.sort((a, b) => {
          return parseInt(a, 10) - parseInt(b, 10)
        })

        // Rotate categories using userId, userExamCount, and randomSeed to ensure variation
        const rotationOffset =
          (((userId * 31 + randomSeed) % sortedCategories.length) + userExamCount) % sortedCategories.length
        const rotatedCategories = [
          ...sortedCategories.slice(rotationOffset),
          ...sortedCategories.slice(0, rotationOffset),
        ]

        // First pass: take one question from each category at this times_taken level
        for (const category of rotatedCategories) {
          if (selected.length >= count) break

          const availableQuestions = questionsByCategory[category][timesTaken]
          if (availableQuestions && availableQuestions.length > 0) {
            // Sort by ID for consistency, then use randomSeed to select
            const sortedQuestions = _.sortBy(availableQuestions, 'id')
            const pickIndex = (randomSeed + selected.length) % sortedQuestions.length
            selected.push(sortedQuestions[pickIndex])

            // Remove the selected question
            questionsByCategory[category][timesTaken] = sortedQuestions.filter((q, idx) => idx !== pickIndex)
          }
        }

        // Second pass: continue with remaining questions at this times_taken level
        let keepGoing = true
        while (keepGoing && selected.length < count) {
          keepGoing = false

          for (const category of rotatedCategories) {
            if (selected.length >= count) break

            const availableQuestions = questionsByCategory[category][timesTaken]
            if (availableQuestions && availableQuestions.length > 0) {
              keepGoing = true
              // Sort by ID for consistency, then use randomSeed to select
              const sortedQuestions = _.sortBy(availableQuestions, 'id')
              const pickIndex = (randomSeed + selected.length) % sortedQuestions.length
              selected.push(sortedQuestions[pickIndex])

              // Remove the selected question
              questionsByCategory[category][timesTaken] = sortedQuestions.filter((q, idx) => idx !== pickIndex)
            }
          }
        }
      }

      return selected
    }

    // Select bodyPart questions
    const selectedBodyPartQuestions = selectQuestionsGlobalPriority(
      bodyPartQuestionsByCategory,
      postQuestionBodyPartCount,
      userId,
      userExamCount
    )

    // Select other questions (non-bodyPart specific)
    const remainingCount = postQuestionCount - selectedBodyPartQuestions.length
    const selectedOtherQuestions = selectQuestionsGlobalPriority(
      otherQuestionsByCategory,
      remainingCount,
      userId,
      userExamCount
    )

    // Fallback: select additional bodyPart questions if needed
    const stillRemainingCount = postQuestionCount - (selectedBodyPartQuestions.length + selectedOtherQuestions.length)
    let additionalBodyPartQuestions = []

    if (stillRemainingCount > 0) {
      const remainingBodyPartQuestions = bodyPartQuestions.filter((q) => !selectedBodyPartQuestions.includes(q))
      const remainingGrouped = groupByCategoryAndTimesTaken(remainingBodyPartQuestions)

      additionalBodyPartQuestions = selectQuestionsGlobalPriority(
        remainingGrouped,
        stillRemainingCount,
        userId,
        userExamCount
      )
    }

    // Combine the final set of questions and filter out any null/undefined elements
    const postTestQuestions = [
      ...selectedBodyPartQuestions,
      ...selectedOtherQuestions,
      ...additionalBodyPartQuestions,
    ].filter((q) => q != null)

    return postTestQuestions
  },

  async getPreparedExamQuestionsByUserAndBodyPart(userId, bodyPartId, type, questionGroupId = null) {
    let whereClause = {
      onlyForPreparedExams: true,
      hideQuestion: false,
    }

    if (questionGroupId) {
      const questionGroup = await questionGroupSvc.getQuestionGroupById(questionGroupId)
      if (questionGroup && questionGroup.questionIds && questionGroup.questionIds.length > 0) {
        whereClause = {
          hideQuestion: false,
          id: {
            [Op.in]: questionGroup.questionIds,
          },
        }
      } else {
        return [] // Return empty array if no questions in the group
      }
    } else {
      // Only apply these filters if no questionGroupId is provided
      whereClause = {
        ...whereClause,
        type: type === 'pre' ? 'SF' : { [Op.ne]: 'SF' },
        categoryId: {
          [Op.in]: [1, 2, 3, 4, 6, 7, 8, 9, 10, 12],
        },
        ...(type === 'pre'
          ? { bodyPartId }
          : {
              [Op.or]: [{ bodyPartId: bodyPartId }, { bodyPartId: { [Op.is]: null } }],
            }),
      }
    }
    const sql = `
      ${ModelProvider.generateCombinedQuery([
        { tableName: 'MultipleChoiceQuestionResults', where: { userId } },
        { tableName: 'TestRuns', where: { userId, preparedExamId: { [Op.not]: null } } },
      ])}
      SELECT
        mcq."id",
        mcq."questionText",
        mcq."hideQuestion",
        mcq."bodyPartId",
        mcq."categoryId",
        mcq."type",
        mcq."isBetaQuestion",
        mcq."betaQuestionAttempts",
        COALESCE(COUNT(mcqr."id"), 0) AS "times_taken"
      FROM "MultipleChoiceQuestions" mcq
      LEFT JOIN "CombinedMultipleChoiceQuestionResults" mcqr
        ON mcq."id" = mcqr."multipleChoiceQuestionId"
        AND mcqr."userId" = :userId
      LEFT JOIN "CombinedTestRuns" tr
        ON mcqr."testRunId" = tr."id"
        AND tr."preparedExamId" IS NOT NULL
      WHERE
        ${whereObjectToSql(whereClause, true, 'mcq')}
      GROUP BY mcq."id"
      ORDER BY "times_taken" ASC
    `
    const questions = await sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId },
    })

    // Filter questions based on type after fetching
    if (type === 'beta') {
      return questions.filter((q) => q.isBetaQuestion === true)
    } else if (type !== 'pre') {
      return questions.filter((q) => q.isBetaQuestion === false)
    }

    return questions
  },
}

module.exports = TestSvc
module.exports.NoQuestionSetAvailableError = NoQuestionSetAvailableError
