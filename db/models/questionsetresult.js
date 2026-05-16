'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionSetResult = sequelize.define(
    'QuestionSetResult',
    {
      score: DataTypes.DECIMAL(5, 2),
      sliceQuantScore: DataTypes.DECIMAL(5, 2),
      overallSkillScores: DataTypes.JSONB,
      isChallengeMode: DataTypes.BOOLEAN,
      isViewedAdminComment: DataTypes.BOOLEAN,
      isViewedUserReply: DataTypes.BOOLEAN,
      isViewedAdminReply: DataTypes.BOOLEAN,
    },
    {}
  )
  QuestionSetResult.associate = function (models) {
    QuestionSetResult.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    QuestionSetResult.belongsTo(models.TestRun, { as: 'testRun', foreignKey: 'testRunId' })
    QuestionSetResult.belongsTo(models.QuestionSet, {
      as: 'questionSet',
      foreignKey: 'questionSetId',
      onDelete: 'CASCADE',
    })
    QuestionSetResult.hasMany(models.StackQuestionResult, {
      as: 'stackQuestionResults',
      foreignKey: 'questionSetResultId',
    })
  }
  return QuestionSetResult
}
