'use strict'
module.exports = (sequelize, DataTypes) => {
  const StackQuestionResultEuWest = sequelize.define(
    'StackQuestionResultEuWest',
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

      commentedUserId: DataTypes.INTEGER, // Foreign key to User
      stackQuestionId: DataTypes.INTEGER, // Foreign key to StackQuestion
      questionSetResultId: DataTypes.INTEGER, // Foreign key to QuestionSetResult
    },
    {
      schema: 'eu_west_server_public', // Specify the schema here
      tableName: 'StackQuestionResults', // Optional: explicitly set table name (useful if it differs from model name)
    }
  )
  StackQuestionResultEuWest.associate = function (models) {
    StackQuestionResultEuWest.belongsTo(models.User, { as: 'commentedUser', foreignKey: 'commentedUserId' })
    StackQuestionResultEuWest.belongsTo(models.StackQuestion, {
      as: 'stackQuestion',
      foreignKey: 'stackQuestionId',
      onDelete: 'CASCADE',
    })
    StackQuestionResultEuWest.belongsTo(models.QuestionSetResultEuWest, {
      as: 'questionSetResult',
      foreignKey: 'questionSetResultId',
      onDelete: 'CASCADE',
      schema: 'eu_west_server_public',
    })
    StackQuestionResultEuWest.hasMany(models.StackQuestionResultCommentEuWest, {
      as: 'stackQuestionResultComments',
      foreignKey: 'stackQuestionResultId',
      schema: 'eu_west_server_public',
    })
  }
  return StackQuestionResultEuWest
}
