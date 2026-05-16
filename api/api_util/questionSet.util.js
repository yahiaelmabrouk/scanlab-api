const _ = require('lodash')
const logger = require('../../util/logger')

const QuestionSetUtil = {
  fillInAndSerializeQuestionSet: async (questionSet, removeAnswersContent) => {
    // If StackQuestions were already eager-loaded (e.g. via findAll include),
    // reuse them directly to avoid an extra per-row DB query (N+1).
    // Sequelize populates the `stackQuestions` property when the association
    // is included; fall back to the lazy getter only when it is absent.
    let stackQuestions =
      questionSet.stackQuestions != null
        ? questionSet.stackQuestions
        : await questionSet.getStackQuestions()

    return _.extend(
      _.pick(questionSet, [
        'id',
        'name',
        'dicomFileSet',
        'bodyPartId',
        'bodyPart',
        'isAvailable',
        'isPreparedExamOnly',
        'isUltraLab',
        'rarity',
        'ageFrom',
        'ageTo',
        'gender',
      ]),
      {
        stackQuestions: _.map(stackQuestions, (stackQuestion) => {
          stackQuestion = _.pick(stackQuestion, [
            'id',
            'questionText',
            'questionType',
            'positionSetId',
            'phaseNum',
            'initialLocalizerWhitelist',
            'displayVariants',
            'displayVariantSelectionId',
            'answers',
            'order',
            'difficulty',
            'ignoreInPlaneRotation',
            'freebie',
            'alterVolumeView',
            'alterSpacingThickness',
            'gradeContats',
            'dontGradeEfficiency',
            'dontGradePixelShift',
            'hasSpecialtyOptions',
            'hdBranchId',
            'ldBranchId',
            'postContrast',
            'title',
            'hideSetDelay',
            'contrastRangePresetId',
          ])
          if (removeAnswersContent) {
            // only admins get told the full answers; otherwise strip out the Min/Max
            // (which is the range of the correct answer)
            stackQuestion.answers = _.map(stackQuestion.answers, (answer) => {
              return _.omitBy(answer, (_data, key) => {
                return key.endsWith('_min') || key.endsWith('_max')
              })
            })
          }
          return stackQuestion
        }),
      }
    )
  },

  identifyMissingRequiredFields: (questionSet) => {
    const missingFields = []

    const { stackQuestions, dicomFileSet, bodyPartId } = questionSet || {}

    if (!bodyPartId) {
      logger.warn('Need to set BodyPart')
      missingFields.push('bodyPartId')
    }

    if (!dicomFileSet) {
      logger.warn('Need DicomFileSet')
      missingFields.push('dicomFileSet')
    }

    if (_.size(stackQuestions) === 0) {
      logger.warn('Need at least one StackQuestion')
      missingFields.push('stackQuestions')
    }

    if (_.some(stackQuestions, ({ answers }) => _.size(answers) === 0)) {
      logger.warn('Each question needs at least one Answer')
      missingFields.push('stackQuestions.answers')
    }

    let someAnswerInvalid = _.some(stackQuestions, (stackQuestion) => {
      return _.some(stackQuestion.answers, (answer) => {
        // || !answer['0_min'] || !answer['0_max']
        // (there may be no groupId 0(could start at any number)
        return !answer.id
      })
    })

    if (someAnswerInvalid) {
      logger.warn('Each answer must have a set Min / Max set')
      missingFields.push('stackQuestions.answers.minMax')
    }

    return missingFields
  },
}

module.exports = QuestionSetUtil
