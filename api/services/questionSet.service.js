const _ = require('lodash')
const logger = require('../../util/logger')
const util = require('../api_util/questionSet.util')
const { QuestionSet, sequelize, StackQuestion, BodyPart, DigitalLocalizer, QuestionProbe } = require('../../db/models')

const QuestionSetService = {
  findAllQuestionSets: async () => {
    const questionSets = await QuestionSet.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: BodyPart,
          as: 'bodyPart',
          attributes: ['id', 'name', 'contrastTypes'],
        },
        {
          // Eager-load StackQuestions to avoid N+1 (one query per row)
          model: StackQuestion,
          as: 'stackQuestions',
        },
      ],
    })

    return await Promise.all(
      questionSets.map(async (questionSet) => await util.fillInAndSerializeQuestionSet(questionSet, true))
    )
  },
  findAllQuestionSetsAndAnswers: async () => {
    const questionSets = await QuestionSet.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: BodyPart,
          as: 'bodyPart',
          attributes: ['id', 'name', 'contrastTypes'],
        },
        {
          // Eager-load StackQuestions to avoid N+1 (one query per row)
          model: StackQuestion,
          as: 'stackQuestions',
        },
      ],
    })

    return await Promise.all(
      questionSets.map(async (questionSet) => await util.fillInAndSerializeQuestionSet(questionSet, false))
    )
  },
  findQuestionSetById: async (questionSetId) => {
    // TODO Once we have the formula for scoring locked down and have time, we should move the scoring logic to the backend, and not send back answers
    return await QuestionSet.findByPk(questionSetId, {
      include: [
        {
          model: BodyPart,
          as: 'bodyPart',
          attributes: ['id', 'name', 'baseId', 'contrastTypes'],
          include: [
            {
              model: DigitalLocalizer,
              as: 'digitalLocalizers',
              required: false,
            },
            {
              model: BodyPart,
              as: 'base',
              required: false,
              include: [
                {
                  model: DigitalLocalizer,
                  as: 'digitalLocalizers',
                  required: false,
                },
                {
                  model: QuestionProbe,
                  as: 'questionProbes',
                  required: false,
                },
              ],
            },
            {
              model: QuestionProbe,
              as: 'questionProbes',
              required: false,
            },
          ],
        },
      ],
    })
  },

  createQuestionSet: async (questionSet) => {
    const missingRequiredFields = util.identifyMissingRequiredFields(questionSet)

    if (_.size(missingRequiredFields) > 0) {
      throw new Error('Failed to create QuestionSet due to missing required fields:', missingRequiredFields)
    }

    const { name, stackQuestions, dicomFileSet, bodyPartId, isAvailable, isPreparedExamOnly, isUltraLab, rarity } =
      questionSet

    // Create QuestionSet
    const created = await QuestionSet.create({
      name,
      dicomFileSet,
      bodyPartId,
      isAvailable,
      isPreparedExamOnly,
      isUltraLab,
      rarity,
    })

    await sequelize.transaction(async (transaction) => {
      // Create Stack Questions
      if (_.isArray(stackQuestions)) {
        for (let stackQuestionData of stackQuestions) {
          const {
            freebie,
            questionText,
            answers,
            difficulty,
            order,
            ignoreInPlaneRotation,
            alterVolumeView,
            alterSpacingThickness,
            gradeContats,
            dontGradeEfficiency,
            dontGradePixelShift,
            hasSpecialtyOptions,
            questionType,
            positionSetId,
            postContrast,
            title,
            hideSetDelay,
            phaseNum,
            initialLocalizerWhitelist,
            displayVariants,
            displayVariantSelectionId,
            contrastRangePresetId,
          } = stackQuestionData
          // Create StackQuestion
          await StackQuestion.create(
            {
              questionText,
              difficulty,
              questionSet: created.id,
              answers,
              order,
              ignoreInPlaneRotation,
              freebie,
              alterVolumeView,
              alterSpacingThickness,
              gradeContats,
              dontGradeEfficiency,
              dontGradePixelShift,
              hasSpecialtyOptions,
              questionType,
              positionSetId,
              postContrast,
              title,
              hideSetDelay,
              phaseNum,
              initialLocalizerWhitelist,
              displayVariants,
              displayVariantSelectionId,
              contrastRangePresetId,
            },
            { transaction }
          )
        }
      }
    })

    logger.info(`Created a QuestionSet: ${created.id}`)

    return await util.fillInAndSerializeQuestionSet(created, false)
  },

  updateQuestionSet: async (questionSet, updatedQuestionSet) => {
    const missingRequiredFields = util.identifyMissingRequiredFields(updatedQuestionSet)

    if (_.size(missingRequiredFields) > 0) {
      throw new Error(
        `Failed to update QuestionSet with ID=${updatedQuestionSet.id} due to missing required fields:`,
        missingRequiredFields
      )
    }

    let {
      name,
      dicomFileSet,
      bodyPartId,
      stackQuestions: stackQuestionsNewData,
      isAvailable,
      isPreparedExamOnly,
      isUltraLab,
      rarity,
      ageFrom,
      ageTo,
      gender,
    } = updatedQuestionSet

    await sequelize.transaction(async (transaction) => {
      // Update QuestionSet itself
      _.extend(questionSet, {
        name,
        dicomFileSet,
        bodyPartId,
        isAvailable,
        isPreparedExamOnly,
        isUltraLab,
        rarity,
        ageFrom,
        ageTo,
        gender,
      })
      await questionSet.save({ transaction })

      if (_.size(stackQuestionsNewData) > 0) {
        let currentStackQuestions = await questionSet.getStackQuestions()

        // Update existing ones, and add new ones
        for (let stackQuestionData of stackQuestionsNewData) {
          let {
            id,
            freebie,
            questionText,
            answers,
            order,
            difficulty,
            ignoreInPlaneRotation,
            alterVolumeView,
            alterSpacingThickness,
            gradeContats,
            dontGradeEfficiency,
            dontGradePixelShift,
            hasSpecialtyOptions,
            hdBranchId,
            ldBranchId,
            questionType,
            positionSetId,
            postContrast,
            title,
            hideSetDelay,
            phaseNum,
            contrastRangePresetId,
            initialLocalizerWhitelist,
            displayVariants,
            displayVariantSelectionId,
          } = stackQuestionData

          // One of the StackQuestions of this QuestionSet has the ID the user sent
          let foundStackQuestion = _.find(currentStackQuestions, { id })

          if (foundStackQuestion) {
            logger.info('Updating StackQuestion with ID=', foundStackQuestion.id)
            _.extend(foundStackQuestion, {
              questionText,
              difficulty,
              answers,
              order,
              ignoreInPlaneRotation,
              freebie,
              alterVolumeView,
              alterSpacingThickness,
              gradeContats,
              dontGradeEfficiency,
              dontGradePixelShift,
              hasSpecialtyOptions,
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
              contrastRangePresetId,
            })
            await foundStackQuestion.save({ transaction })

            // Create new one (if StackQuestion had no id yet)
          } else if (!id) {
            let result = await StackQuestion.create(
              {
                questionText,
                difficulty,
                questionSet: questionSet.id,
                answers,
                order,
                ignoreInPlaneRotation,
                freebie,
                alterVolumeView,
                alterSpacingThickness,
                gradeContats,
                dontGradeEfficiency,
                dontGradePixelShift,
                hasSpecialtyOptions,
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
                contrastRangePresetId,
              },
              { transaction }
            )
            logger.info('Creating StackQuestion with ID=', result.id)
          } else {
            throw Error(
              `Error: trying to associate a different QuestionSet's StackQuestion with this one ${questionSet.id}, ${foundStackQuestion.id}`
            )
          }
        }

        // Delete removed questions
        for (let stackQuestionExisting of currentStackQuestions) {
          // If none of the desired questions have the ID of this existing question
          if (!_.some(stackQuestionsNewData, { id: stackQuestionExisting.id })) {
            logger.info('Deleting question', stackQuestionExisting.id)
            await stackQuestionExisting.destroy({ transaction })
          }
        }
      }
    })

    return await util.fillInAndSerializeQuestionSet(questionSet, false)
  },

  deleteQuestionSet: async (questionSet) => {
    const stackQuestions = await questionSet.getStackQuestions()

    await sequelize.transaction(async (transaction) => {
      // Delete related Questions
      for (let stackQuestion of stackQuestions) {
        logger.info(`Deleting StackQuestion with ID=${stackQuestion.id}`)

        await stackQuestion.destroy({ transaction })
      }

      // then QuestionSet itself
      logger.info(`Deleting QuestionSet with ID=${questionSet.id}`)

      await questionSet.destroy({ transaction })
    })
  },
}

module.exports = QuestionSetService
