const _ = require('lodash')
const { v4: uuidv4 } = require('uuid')
const { Op } = require('sequelize')
const logger = require('../../util/logger')
const { calculateMultipleAnswerScore } = require('../api_util/criticalThinkingScore')
const { sendMail } = require('../../util/email')
const { isProduction } = require('../../util/environment')
const { S3_BUCKET, getUploadUrl, createPresignedPost, deleteObject } = require('../api_util/aws')
const {
  MultipleChoiceQuestion,
  QuestionMediaUpload,
  QuestionMedia,
  QuestionMediaDicom,
  Category,
  QuestionMiscDocument,
  Sequelize,
} = require('../../db/models')
const DicomSvc = require('./dicom.service')
const { isString } = require('lodash')
const ModelProvider = require('../providers/model.provider')

const prepMedia = async (media) => {
  if (!media) {
    return null
  }

  if (media.questionMediaUpload) {
    return {
      id: media.questionMediaUpload.id,
      pathKey: media.questionMediaUpload.pathKey,
      src: await getUploadUrl(media.questionMediaUpload.pathKey),
      alt: media.questionMediaUpload.alt,
      filename: media.questionMediaUpload.filename,
      type: media.questionMediaUpload.type,
      dimensions: media.questionMediaUpload.dimensions,
      mediaId: media.id,
    }
  } else if (media.questionMediaDicom) {
    const dicomFileSet = await DicomSvc.findDicomById(media.questionMediaDicom.dicomFileSetId)
    if (!dicomFileSet) {
      throw new Error(`Cannot find Dicom ID ${media.questionMediaDicom.dicomFileSetId}`)
    }
    return {
      id: media.questionMediaDicom.id,
      dicomFileSetId: media.questionMediaDicom.dicomFileSetId,
      ...(await DicomSvc.getSignedUrls(dicomFileSet)),
      mediaId: media.id,
    }
  } else {
    return null
  }
}

const CriticalThinkingQuestionSvc = {
  // Upload media for question, based on DICOM uploading
  async uploadMediaForQuestion(multipleChoiceQuestionId, filename, type, dimensions) {
    if (!_.isString(filename)) {
      throw new Error('Invalid filename')
    } else {
      const pathKey = `question-media/${uuidv4()}/${filename}`
      logger.info('Uploading to presigned key: ' + pathKey)

      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createPresignedPost-property
      const response = await createPresignedPost(pathKey, S3_BUCKET, type)

      const questionMedia = await QuestionMedia.create({
        multipleChoiceQuestionId,
      })
      await QuestionMediaUpload.create({
        pathKey,
        filename,
        type,
        dimensions,
        questionMediaId: questionMedia.id,
      })

      // In the format for use with Vue2Dropzone:
      // https://rowanwins.github.io/vue-dropzone/docs/dist/#/aws-s3-upload
      return {
        postEndpoint: response.url,
        signature: response.fields,
      }
    }
  },
  async uploadMiscDocumentForQuestion(multipleChoiceQuestionId, filename, type) {
    if (!_.isString(filename)) {
      throw new Error('Invalid filename')
    } else {
      const pathKey = `question-misc-documents/${uuidv4()}/${filename}`
      logger.info('Uploading to presigned key: ' + pathKey)

      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createPresignedPost-property
      const response = await createPresignedPost(pathKey, S3_BUCKET, type)

      const newQuestionMiscDocument = await QuestionMiscDocument.create({
        pathKey,
        filename,
        type,
        multipleChoiceQuestionId,
      })

      // In the format for use with Vue2Dropzone:
      // https://rowanwins.github.io/vue-dropzone/docs/dist/#/aws-s3-upload
      return {
        id: newQuestionMiscDocument.id,
        filename,
        type,
        postEndpoint: response.url,
        signature: response.fields,
      }
    }
  },
  async addDicomMedia(multipleChoiceQuestionId, dicomFileSetId) {
    await this.deleteMedia(multipleChoiceQuestionId)
    const questionMedia = await QuestionMedia.create({
      multipleChoiceQuestionId,
    })
    await QuestionMediaDicom.create({
      dicomFileSetId,
      questionMediaId: questionMedia.id,
    })
  },

  async getMedia(questionId) {
    let media = await QuestionMedia.findOne({
      where: {
        multipleChoiceQuestionId: questionId,
      },
      include: [
        {
          model: QuestionMediaUpload,
          as: 'questionMediaUpload',
          required: false,
        },
        {
          model: QuestionMediaDicom,
          as: 'questionMediaDicom',
          required: false,
        },
      ],
    })

    return await prepMedia(media)
  },

  /**
   * Batch-load media for many questions in a single DB query, then resolve
   * each record through prepMedia (which may issue one S3/DICOM call per
   * DICOM record – all fired in parallel).
   *
   * @param {string[]} questionIds
   * @returns {Promise<Object.<string, *>>} map of questionId → prepared media (or null)
   */
  async batchGetMedia(questionIds) {
    if (!questionIds || questionIds.length === 0) return {}

    const allMedia = await QuestionMedia.findAll({
      where: {
        multipleChoiceQuestionId: { [Op.in]: questionIds },
      },
      include: [
        { model: QuestionMediaUpload, as: 'questionMediaUpload', required: false },
        { model: QuestionMediaDicom, as: 'questionMediaDicom', required: false },
      ],
    })

    // Resolve prepMedia for all records in parallel (DICOM records hit S3 here)
    const resolved = await Promise.all(
      allMedia.map(async (media) => ({
        questionId: media.multipleChoiceQuestionId,
        preparedMedia: await prepMedia(media),
      }))
    )

    // Build a lookup map keyed by questionId
    return _.keyBy(resolved, 'questionId')
  },

  async gradeUserAnswers(criticalThinkingAnswers, test, completionTimestamp, transaction) {
    const userId = test.userId
    const modelProvider = await ModelProvider.getModelProvider(userId)
    // grade the critical thinking questions
    if (criticalThinkingAnswers) {
      let criticalQuestionIds = _.map(criticalThinkingAnswers, 'questionId')

      let criticalThinkingQuestions = await MultipleChoiceQuestion.findAll(
        {
          where: {
            id: {
              [Sequelize.Op.in]: criticalQuestionIds,
            },
          },
          include: [
            {
              model: Category,
              as: 'category',
              required: false,
              attributes: ['name'],
            },
          ],
        },
        { transaction }
      )

      // Batch-load media for all questions up-front (avoids N+1 getMedia calls)
      const mediaMap = await this.batchGetMedia(criticalQuestionIds)

      // Figure out which MultiChoiceQuestions the user got correct, expose explanation
      let criticalThinkingResults = await Promise.all(
        _.map(criticalThinkingAnswers, async (userAnswer) => {
          const answerData = userAnswer.selectedAnswer
          const currentQuestion = _.find(criticalThinkingQuestions, { id: userAnswer.questionId })

          let selectedAnswerShown = null // Shown to the user as part of Test Results (what they picked)
          if (currentQuestion.type === 'MC' || currentQuestion.type === 'SF') {
            userAnswer.score = calculateMultipleAnswerScore(currentQuestion, answerData)
            let pickedAnswerIds = answerData.split(',')
            // Show what they picked to user, like: A, B
            selectedAnswerShown = _.join(
              _.map(pickedAnswerIds, function (answerId) {
                let choiceData = _.find(currentQuestion.choices, { id: answerId })
                return _.get(choiceData, 'text') || '?'
              }),
              ', '
            )
          } else if (currentQuestion.type === 'TR') {
            selectedAnswerShown = answerData
            if (answerData >= currentQuestion.range[0] && answerData <= currentQuestion.range[1]) {
              userAnswer.score = 100
            } else {
              // Calculate score reduction based on how far off the answer is
              let scoreReduction = 0
              if (answerData < currentQuestion.range[0]) {
                // Too early: 40% reduction per second
                const secondsEarly = currentQuestion.range[0] - answerData
                scoreReduction = secondsEarly * 40
              } else {
                // Too late: 20% reduction per second
                const secondsLate = answerData - currentQuestion.range[1]
                scoreReduction = secondsLate * 20
              }
              // Score cannot go below 0
              userAnswer.score = Math.max(0, 100 - scoreReduction)
            }
          } else if (currentQuestion.type === 'PS') {
            const noSelectionNeeded = !currentQuestion.range || currentQuestion.range.noSelections
            if (noSelectionNeeded) {
              if (answerData.noSelections) {
                userAnswer.score = 100
              } else {
                userAnswer.score = 0
              }
            } else {
              if (answerData.noSelections) {
                userAnswer.score = 0
              } else {
                selectedAnswerShown = _.get(answerData, ['selection'])

                // Selection has id. It mean user select correct point. If user select incorrect point, we can't retrieve selection id from selection
                const selectionId = _.get(selectedAnswerShown, ['id'])
                if (!_.isNil(selectionId)) {
                  userAnswer.score = 100
                } else {
                  userAnswer.score = 0
                }
              }
            }
          }

          return {
            text: currentQuestion.questionText,
            score: userAnswer.score,
            multipleChoiceQuestionId: currentQuestion.id,
            answerExplanation: currentQuestion.answerExplanation,
            media: _.get(mediaMap, [currentQuestion.id, 'preparedMedia'], null),
            type: currentQuestion.type,
            range: currentQuestion.range,
            choices: currentQuestion.choices,
            selectedAnswer: answerData,
            selectedAnswerShown,
            screeningForm: currentQuestion.screeningForm,
            category: currentQuestion.category,
            isBetaQuestion: currentQuestion.isBetaQuestion,
          }
        })
      )

      for (const abandonedCriticalThinkingQuestion of _.filter(test.questions, (q) => q.type !== 'QUESTIONSET')) {
        if (!_.some(criticalThinkingAnswers, (a) => a.questionId === abandonedCriticalThinkingQuestion.id)) {
          criticalThinkingResults.push({
            isCorrect: false,
            selectedAnswer: null,
            multipleChoiceQuestionId: abandonedCriticalThinkingQuestion.id,
            score: 0,
          })
        }
      }

      // Allow questionCount increases in sandbox environment
      // if (!test.isSandbox) {
      // Persist MultiChoiceQuestionResults
      for (const criticalThinkingResult of criticalThinkingResults) {
        let { selectedAnswer, score, multipleChoiceQuestionId, screeningForm } = criticalThinkingResult
        // TODO(follow-up): when selectedAnswer is nil this writes the literal string 'null'
        // (JSON.stringify(null) === 'null') into MultipleChoiceQuestionResults.answer for
        // abandoned questions. Should store real null instead, plus a data migration to fix
        // existing rows in both schemas: UPDATE "MultipleChoiceQuestionResults" SET answer = NULL
        // WHERE answer = 'null'. Currently worked around at statistic.service.js getStatisticMcWhomSql
        // via NULLIF(answer, 'null'); remove that workaround once this is fixed.
        const answer = isString(selectedAnswer) ? selectedAnswer : JSON.stringify(selectedAnswer)
        await modelProvider.MultipleChoiceQuestionResult.create(
          {
            answer,
            score: score || 0, // this value must be non-null in DB
            userId: test.userId,
            multipleChoiceQuestionId,
            testRunId: test.id,
            createdAt: completionTimestamp,
            screeningForm,
          },
          { transaction }
        )

        // Increment betaQuestionAttempts if it's a beta question
        if (criticalThinkingResult.isBetaQuestion) {
          await MultipleChoiceQuestion.increment('betaQuestionAttempts', {
            where: { id: multipleChoiceQuestionId },
            transaction,
          })
        }
      }

      // Separate out the beta questions
      const betaQuestions = _.filter(criticalThinkingResults, (q) => q.isBetaQuestion)
      const regularQuestions = _.filter(criticalThinkingResults, (q) => !q.isBetaQuestion)

      return {
        criticalThinkingResults: regularQuestions,
        betaResults: betaQuestions,
      }
    }

    return {
      criticalThinkingResults: [],
      betaResults: [],
    }
  },

  async deleteMedia(questionId) {
    let media = await this.getMedia(questionId)
    if (!media) {
      return
    }

    if (media.filename) {
      await deleteObject(S3_BUCKET, media.pathKey)

      await QuestionMediaUpload.destroy({
        where: {
          questionMediaId: media.mediaId,
        },
      })
    } else if (media.dicomFileSetId) {
      await QuestionMediaDicom.destroy({
        where: {
          questionMediaId: media.mediaId,
        },
      })
    }

    await QuestionMedia.destroy({
      where: {
        id: media.mediaId,
      },
    })
  },

  // Lightweight list for the left panel — no media, no S3 calls
  async listCriticalThinkingQuestions(type) {
    const where = {
      [Op.or]: [
        {
          onlyForPreparedExams: {
            [Op.or]: type === 'all' ? [true, false] : [type === 'prepared'],
          },
        },
        { globalQuestion: { [Op.eq]: true } },
      ],
    }
    const multipleChoiceQuestions = await MultipleChoiceQuestion.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'questionText',
        'type',
        'categoryId',
        'bodyPartId',
        'difficulty',
        'hideQuestion',
        'onlyForPreparedExams',
        'isGeneralQuestion',
        'keepOrder',
        'createdAt',
      ],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    })
    return multipleChoiceQuestions.map((q) => q.toJSON())
  },

  // Get all
  async getAllCriticalThinkingQuestions(type) {
    const where = {
      [Op.or]: [
        {
          onlyForPreparedExams: {
            [Op.or]: type === 'all' ? [true, false] : [type === 'prepared'],
          },
        },
        { globalQuestion: { [Op.eq]: true } },
      ],
    }
    let multipleChoiceQuestions = await MultipleChoiceQuestion.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'questionText',
        'difficulty',
        'choices',
        'categoryId',
        'bodyPartId',
        'answerExplanation',
        'type',
        'range',
        'onlyForPreparedExams',
        'globalQuestion',
        'hideQuestion',
        'secondsToAnswer',
        'screeningForm',
        'isGeneralQuestion',
        'keepOrder',
      ],
      include: [
        {
          model: QuestionMiscDocument,
          as: 'questionMiscDocuments',
          required: false,
        },
      ],
    })

    // Batch-load all media in a single query instead of one query per question (was N+1)
    const questionIds = _.map(multipleChoiceQuestions, 'id')
    const mediaMap = await this.batchGetMedia(questionIds)

    multipleChoiceQuestions = await Promise.all(_.map(multipleChoiceQuestions, async (q) => {
      let newQ = q.toJSON()
      newQ.media = _.get(mediaMap, [q.id, 'preparedMedia'], null)
      if (newQ.questionMiscDocuments) {
        newQ.questionMiscDocuments = await Promise.all(_.map(newQ.questionMiscDocuments, async (miscDocument) => {
          miscDocument.src = await getUploadUrl(miscDocument.pathKey)
          return miscDocument
        }))
      }
      return newQ
    }))

    return multipleChoiceQuestions
  },

  // Create
  async newCriticalThinkingQuestion(multipleChoiceQuestion) {
    let result = await MultipleChoiceQuestion.create(
      _.pick(multipleChoiceQuestion, [
        'questionText',
        'difficulty',
        'choices',
        'categoryId',
        'bodyPartId',
        'answerExplanation',
        'type',
        'range',
        'onlyForPreparedExams',
        'globalQuestion',
        'hideQuestion',
        'screeningForm',
        'isGeneralQuestion',
        'keepOrder',
        'isBetaQuestion',
        'betaQuestionAttempts',
      ])
    )

    if (multipleChoiceQuestion.type === 'SF') {
      let newScreeningFormValues = Object.assign({}, multipleChoiceQuestion.screeningForm)
      let multipleChoiceQuestionDB = await MultipleChoiceQuestion.findByPk(result.id)
      multipleChoiceQuestion.screeningForm = newScreeningFormValues
      _.extend(multipleChoiceQuestionDB, multipleChoiceQuestion)
      await multipleChoiceQuestionDB.save()
    }

    let mediaUploadData
    if (multipleChoiceQuestion.media) {
      if (multipleChoiceQuestion.media.filename) {
        mediaUploadData = await this.uploadMediaForQuestion(
          result.id,
          multipleChoiceQuestion.media.filename,
          multipleChoiceQuestion.media.type,
          multipleChoiceQuestion.media.dimensions
        )
      } else if (multipleChoiceQuestion.media.dicomFileSetId) {
        const questionMedia = await QuestionMedia.create({
          multipleChoiceQuestionId: result.id,
        })
        mediaUploadData = await QuestionMediaDicom.create({
          dicomFileSetId: multipleChoiceQuestion.media.dicomFileSetId,
          questionMediaId: questionMedia.id,
        })
      }
      multipleChoiceQuestion.media.isNew = false
    }

    let questionMiscDocuments = _.get(multipleChoiceQuestion, 'questionMiscDocuments', [])
    const uploadedMiscDocuments = _.filter(questionMiscDocuments, (q) => !q.isNew)
    for (const miscDocument of uploadedMiscDocuments) {
      await this.duplicateMiscDocument(miscDocument, result.id)
    }
    const miscDocumentsUploadData = []
    for (const questionMiscDocument of questionMiscDocuments) {
      if (questionMiscDocument.isNew) {
        const uploadData = await this.uploadMiscDocumentForQuestion(
          multipleChoiceQuestion.id,
          questionMiscDocument.filename,
          questionMiscDocument.type
        )
        questionMiscDocument.isNew = false
        miscDocumentsUploadData.push(uploadData)
      }
    }

    const newMiscDocuments = await QuestionMiscDocument.findAll({
      where: {
        multipleChoiceQuestionId: result.id,
      },
    })

    return { id: result.id, mediaUploadData, questionMiscDocuments: newMiscDocuments }
  },

  // Get One
  async getCriticalThinkingQuestion(multipleChoiceQuestionId) {
    let multipleChoiceQuestionDB = await MultipleChoiceQuestion.findByPk(multipleChoiceQuestionId, {
      include: [
        {
          model: Category,
          as: 'category',
        },
        {
          model: QuestionMiscDocument,
          as: 'questionMiscDocuments',
          required: false,
        },
      ],
    })

    let multipleChoiceQuestion = multipleChoiceQuestionDB.toJSON()
    multipleChoiceQuestion.media = await this.getMedia(multipleChoiceQuestionId)
    if (multipleChoiceQuestion.questionMiscDocuments) {
      multipleChoiceQuestion.questionMiscDocuments = await Promise.all(_.map(
        multipleChoiceQuestion.questionMiscDocuments,
        async (miscDocument) => {
          miscDocument.src = await getUploadUrl(miscDocument.pathKey)
          return miscDocument
        }
      ))
    }
    multipleChoiceQuestion.isMultiSelect = multipleChoiceQuestion.choices.filter((c) => c.isCorrect).length > 1
    return multipleChoiceQuestion
  },

  async deleteMiscDocument(miscDocument, multipleChoiceQuestionId) {
    const existingDocumentWithSamePathKey = await QuestionMiscDocument.findOne({
      where: {
        pathKey: miscDocument.pathKey,
        multipleChoiceQuestionId: {
          [Op.ne]: multipleChoiceQuestionId,
        },
      },
    })
    await QuestionMiscDocument.destroy({
      where: {
        id: miscDocument.id,
      },
    })
    if (existingDocumentWithSamePathKey) {
      return
    }
    await deleteObject(S3_BUCKET, miscDocument.pathKey)
  },
  async duplicateMiscDocument(miscDocument, multipleChoiceQuestionId) {
    const newMiscDocument = await QuestionMiscDocument.create({
      pathKey: miscDocument.pathKey,
      filename: miscDocument.filename,
      type: miscDocument.type,
      multipleChoiceQuestionId,
    })
    return newMiscDocument
  },

  // Edit
  async modifyCriticalThinkingQuestion(multipleChoiceQuestion) {
    let multipleChoiceQuestionDB = await MultipleChoiceQuestion.findByPk(multipleChoiceQuestion.id)

    if (multipleChoiceQuestion.type === 'SF') {
      let newScreeningFormValues = Object.assign(
        {},
        multipleChoiceQuestionDB.screeningForm,
        multipleChoiceQuestion.screeningForm
      )

      multipleChoiceQuestion.screeningForm = newScreeningFormValues
    }
    _.extend(multipleChoiceQuestionDB, multipleChoiceQuestion)

    // allow for the body part to be removed
    if (!multipleChoiceQuestion.bodyPartId) {
      multipleChoiceQuestionDB.bodyPartId = null
    }

    let mediaUploadData
    if (multipleChoiceQuestion.media.isNew) {
      await this.deleteMedia(multipleChoiceQuestion.id)
    }

    let questionMiscDocuments = _.get(multipleChoiceQuestion, 'questionMiscDocuments', [])
    const modifyUploadedMiscDocumentIds = _.map(
      _.filter(questionMiscDocuments, (q) => !q.isNew),
      'id'
    )
    const existingMiscDocuments = await QuestionMiscDocument.findAll({
      where: {
        multipleChoiceQuestionId: multipleChoiceQuestion.id,
      },
    })
    const miscDocumentsToDelete = _.filter(existingMiscDocuments, (q) => !modifyUploadedMiscDocumentIds.includes(q.id))
    for (const miscDocument of miscDocumentsToDelete) {
      await this.deleteMiscDocument(miscDocument, multipleChoiceQuestion.id)
    }
    const miscDocumentsUploadData = []
    for (const questionMiscDocument of questionMiscDocuments) {
      if (questionMiscDocument.isNew) {
        const uploadData = await this.uploadMiscDocumentForQuestion(
          multipleChoiceQuestion.id,
          questionMiscDocument.filename,
          questionMiscDocument.type
        )
        questionMiscDocument.isNew = false
        miscDocumentsUploadData.push(uploadData)
      }
    }

    if (multipleChoiceQuestion.media.filename) {
      if (multipleChoiceQuestion.media.isNew) {
        mediaUploadData = await this.uploadMediaForQuestion(
          multipleChoiceQuestion.id,
          multipleChoiceQuestion.media.filename,
          multipleChoiceQuestion.media.type,
          multipleChoiceQuestion.media.dimensions
        )
        multipleChoiceQuestion.media.isNew = false
      }
    } else if (multipleChoiceQuestion.media.dicomFileSetId) {
      if (multipleChoiceQuestion.media.isNew) {
        const questionMedia = await QuestionMedia.create({
          multipleChoiceQuestionId: multipleChoiceQuestion.id,
        })
        mediaUploadData = await QuestionMediaDicom.create({
          dicomFileSetId: multipleChoiceQuestion.media.dicomFileSetId,
          questionMediaId: questionMedia.id,
        })
        multipleChoiceQuestion.media.isNew = false
      }
    }

    await multipleChoiceQuestionDB.save()
    return { id: multipleChoiceQuestionDB.id, mediaUploadData, miscDocumentsUploadData }
  },

  // Delete
  async deleteCriticalThinkingQuestion(multipleChoiceQuestionId) {
    await this.deleteMedia(multipleChoiceQuestionId)

    const existingMiscDocuments = await QuestionMiscDocument.findAll({
      where: {
        multipleChoiceQuestionId,
      },
    })
    for (const miscDocument of existingMiscDocuments) {
      await this.deleteMiscDocument(miscDocument, multipleChoiceQuestionId)
    }

    await MultipleChoiceQuestion.destroy({
      where: {
        id: multipleChoiceQuestionId,
      },
    })
  },

  async reportCriticalThinkingQuestion(multipleChoiceQuestionId, userId, feedback, isCTLab) {
    const questionData = await this.getCriticalThinkingQuestion(multipleChoiceQuestionId)
    const to = 'Questions@ScanLabMR.com'
    const subject = `User Feedback on Critical Thinking Question ${multipleChoiceQuestionId}`
    const url = `${
      isProduction() ? (isCTLab ? 'https://app.scanlabct.com' : 'https://app.scanlabmr.com') : 'http://localhost:8080'
    }/critical-thinking-manager?id=${multipleChoiceQuestionId}`
    const html = `
          <h2>Question Info</h2>
          <h3>Question Text</h3>
          <p>${questionData.questionText}</p>
          <h3>Answer Explanation</h3>
          <p>${questionData.answerExplanation}</p>
          <h3>Link</h3>
          <a href=${url}>${url}</a>
          <h2>User (ID: ${userId}) Report</h2>
          <p>"${feedback}"</p>
          `
    return await sendMail({ to, subject, html })
  },
}

module.exports = CriticalThinkingQuestionSvc
