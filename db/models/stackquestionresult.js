'use strict'
module.exports = (sequelize, DataTypes) => {
  const StackQuestionResult = sequelize.define(
    'StackQuestionResult',
    {
      score: DataTypes.DECIMAL(5, 2),
      answer: DataTypes.JSON,
      attemptedAnswerIdentifier: DataTypes.STRING,
      groupScoreVariables: DataTypes.JSON,
      sliceViews: DataTypes.JSONB,
      answerViews: DataTypes.JSONB,
      skipped: DataTypes.BOOLEAN,
      freebie: DataTypes.BOOLEAN,
      sliceQuantScores: DataTypes.JSONB,
      comment: DataTypes.STRING,
      commentCreatedAt: DataTypes.DATE(6),
      skillScores: DataTypes.JSONB,
      commentSeenAt: DataTypes.DATE(6),
      isViewedAdminComment: DataTypes.BOOLEAN,

      reply: DataTypes.STRING,
      replyCreatedAt: DataTypes.DATE(6),
      replySeenAt: DataTypes.DATE(6),
      isViewedUserReply: DataTypes.BOOLEAN,

      adminReply: DataTypes.STRING,
      adminReplyCreatedAt: DataTypes.DATE(6),
      adminReplySeenAt: DataTypes.DATE(6),
      isViewedAdminReply: DataTypes.BOOLEAN,
      adminRepliedUserId: DataTypes.INTEGER,
    },
    {}
  )
  StackQuestionResult.associate = function (models) {
    StackQuestionResult.belongsTo(models.User, { as: 'commentedUser', foreignKey: 'commentedUserId' })
    StackQuestionResult.belongsTo(models.StackQuestion, {
      as: 'stackQuestion',
      foreignKey: 'stackQuestionId',
      onDelete: 'CASCADE',
    })
    StackQuestionResult.belongsTo(models.QuestionSetResult, {
      as: 'questionSetResult',
      foreignKey: 'questionSetResultId',
      onDelete: 'CASCADE',
    })
    StackQuestionResult.hasMany(models.StackQuestionResultComment, {
      as: 'stackQuestionResultComments',
      foreignKey: 'stackQuestionResultId',
    })
  }
  return StackQuestionResult
}
