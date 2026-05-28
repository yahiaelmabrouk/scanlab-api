const { sequelize, Sequelize } = require('../../db/models')
const { Op } = Sequelize
const _ = require('lodash')
const ModelProvider = require('../providers/model.provider')
const statsCacheHelper = require('../statsCacheHelper')
const notificationEvents = require('./notificationEvents')

const viewComment = async (loggedInUserId, testRunUserId, data) => {
  const modelProvider = await ModelProvider.getModelProvider(testRunUserId)
  const { stackQuestionResultId, studentId } = data
  const stackQuestionResultCommentSql = `
  SELECT
    sqrc.*,
    json_build_object('id', cu."id", 'legalName', COALESCE (cuui."legalName", cuuei."legalName", 'N/A')) AS "commentedUser",
    json_build_object('id', vu."id", 'legalName', COALESCE (vuui."legalName", vuuei."legalName", 'N/A')) AS "viewedUser"
  FROM "${modelProvider.StackQuestionResultComment._schema || 'public'}"."${
    modelProvider.StackQuestionResultComment.tableName
  }" sqrc
  LEFT JOIN "Users" cu
    ON sqrc."commentedUserId" = cu."id"
  LEFT JOIN "Users" vu
    ON sqrc."viewedUserId" = vu."id"
  LEFT JOIN "public"."UserInformations" cuui 
    ON cuui."userId" = "cu"."id"
  LEFT JOIN "eu_west_server_public"."UserInformations" cuuei 
    ON cuuei."userId" = "cu"."id"
  LEFT JOIN "public"."UserInformations" vuui 
    ON vuui."userId" = "vu"."id"
  LEFT JOIN "eu_west_server_public"."UserInformations" vuuei 
    ON vuuei."userId" = "vu"."id"
  WHERE sqrc."stackQuestionResultId" = :stackQuestionResultId
  `
  const stackQuestionResultComments = await sequelize.query(stackQuestionResultCommentSql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { stackQuestionResultId },
  })

  if (!stackQuestionResultComments) {
    throw { status: 400, message: 'StackQuestionResultComment not found' }
  }

  const allAdminComments = stackQuestionResultComments.filter((comment) => comment.commentedUserId !== studentId)
  const allStudentComments = stackQuestionResultComments.filter((comment) => comment.commentedUserId === studentId)
  const isStudentView = studentId == loggedInUserId

  const unseenAdminCommentIds = allAdminComments.filter((c) => !c.seen).map((c) => c.id)
  const unseenStudentCommentIds = allStudentComments.filter((c) => !c.seen).map((c) => c.id)

  await sequelize.transaction(async (transaction) => {
    const unseenIds = isStudentView ? unseenAdminCommentIds : unseenStudentCommentIds
    if (unseenIds.length > 0) {
      await modelProvider.StackQuestionResultComment.update(
        { seen: true, seenAt: new Date(), viewedUserId: loggedInUserId },
        { where: { id: { [Op.in]: unseenIds } }, transaction }
      )
    }
  })

  // Refresh cache asynchronously after marking comments as seen
  setImmediate(async () => {
    try {
      await statsCacheHelper.refreshCachesAfterCommentChange(testRunUserId)
    } catch (err) {
      console.log('refreshCachesAfterCommentChange failed in viewComment', err)
    }
  })

  return stackQuestionResultComments
}

const createComment = async (loggedInUserId, testRunUserId, data) => {
  const modelProvider = await ModelProvider.getModelProvider(testRunUserId)
  const { stackQuestionResultId, comment } = data
  const stackQuestionResult = await modelProvider.StackQuestionResult.findByPk(stackQuestionResultId)
  if (!stackQuestionResult) {
    throw { status: 400, message: 'StackQuestionResult not found' }
  }
  const stackQuestionResultComment = await modelProvider.StackQuestionResultComment.create({
    stackQuestionResultId,
    comment,
    seen: false,
    createdAt: new Date(),
    commentedUserId: loggedInUserId,
    lastedUpdatedAt: new Date(),
  })
  if (!stackQuestionResultComment) {
    throw { status: 400, message: 'StackQuestionResultComment not created' }
  }

  // Refresh cache asynchronously after creating comment
  setImmediate(async () => {
    try {
      await statsCacheHelper.refreshCachesAfterCommentChange(testRunUserId)
    } catch (err) {
      console.log('refreshCachesAfterCommentChange failed in createComment', err)
    }
  })

  // Fire-and-forget notifications. Resolve the test run id for a precise deep
  // link (best-effort).
  setImmediate(async () => {
    let testRunId = null
    try {
      if (stackQuestionResult.questionSetResultId) {
        const qsr = await modelProvider.QuestionSetResult.findByPk(stackQuestionResult.questionSetResultId, {
          attributes: ['testRunId'],
        })
        testRunId = qsr ? qsr.testRunId : null
      }
    } catch (err) {
      // Deep link is best-effort; the notification falls back to the test-runs list.
    }

    // Direction matters: when the test-run owner (student) comments, it's a reply to
    // feedback → notify the instructor(s) who left feedback. Otherwise an instructor
    // is leaving feedback → notify the student.
    const isStudentReply = parseInt(loggedInUserId, 10) === parseInt(testRunUserId, 10)
    if (isStudentReply) {
      try {
        const priorComments = await modelProvider.StackQuestionResultComment.findAll({
          where: { stackQuestionResultId, commentedUserId: { [Op.ne]: loggedInUserId } },
          attributes: ['commentedUserId'],
        })
        const feedbackAuthorIds = priorComments.map((c) => c.commentedUserId)
        notificationEvents.notifyFeedbackReplied(testRunUserId, feedbackAuthorIds, testRunId)
      } catch (err) {
        console.log('notifyFeedbackReplied resolution failed in createComment', err)
      }
    } else {
      notificationEvents.notifyFeedbackReceived(testRunUserId, loggedInUserId, testRunId)
    }
  })

  return stackQuestionResultComment
}

const updateComment = async (id, loggedInUserId, testRunUserId, data) => {
  const modelProvider = await ModelProvider.getModelProvider(testRunUserId)
  const { comment } = data
  const stackQuestionResultComment = await modelProvider.StackQuestionResultComment.findByPk(id)
  if (!stackQuestionResultComment) {
    throw { status: 400, message: 'StackQuestionResultComment not found' }
  }
  if (stackQuestionResultComment.commentedUserId !== loggedInUserId) {
    throw { status: 403, message: 'You are not allowed to update this comment' }
  }
  _.extend(stackQuestionResultComment, {
    comment,
    seen: false,
    commentedUserId: loggedInUserId,
    lastedUpdatedAt: new Date(),
  })
  await stackQuestionResultComment.save()

  // Refresh cache asynchronously after updating comment
  setImmediate(async () => {
    try {
      await statsCacheHelper.refreshCachesAfterCommentChange(testRunUserId)
    } catch (err) {
      console.log('refreshCachesAfterCommentChange failed in updateComment', err)
    }
  })

  return stackQuestionResultComment
}

const stackQuestionResultCommentService = {
  viewComment,
  createComment,
  updateComment,
}

module.exports = stackQuestionResultCommentService
