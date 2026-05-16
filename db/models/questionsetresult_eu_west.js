'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionSetResultEuWest = sequelize.define(
    'QuestionSetResultEuWest',
    {
      score: DataTypes.DECIMAL(5, 2),
      sliceQuantScore: DataTypes.DECIMAL(5, 2),
      overallSkillScores: DataTypes.JSONB,
      isChallengeMode: DataTypes.BOOLEAN,
      isViewedAdminComment: DataTypes.BOOLEAN,
      isViewedUserReply: DataTypes.BOOLEAN,
      isViewedAdminReply: DataTypes.BOOLEAN,
      userId: DataTypes.INTEGER, // Foreign key to User
      testRunId: DataTypes.INTEGER, // Foreign key to TestRun
      questionSetId: DataTypes.INTEGER, // Foreign key to QuestionSet
    },
    {
      schema: 'eu_west_server_public', // Specify the schema here
      tableName: 'QuestionSetResults', // Optional: explicitly set table name (useful if it differs from model name)
    }
  )
  QuestionSetResultEuWest.associate = function (models) {
    QuestionSetResultEuWest.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    QuestionSetResultEuWest.belongsTo(models.TestRunEuWest, {
      as: 'testRun',
      foreignKey: 'testRunId',
      schema: 'eu_west_server_public',
    })
    QuestionSetResultEuWest.belongsTo(models.QuestionSet, {
      as: 'questionSet',
      foreignKey: 'questionSetId',
      onDelete: 'CASCADE',
    })
    QuestionSetResultEuWest.hasMany(models.StackQuestionResultEuWest, {
      as: 'stackQuestionResults',
      foreignKey: 'questionSetResultId',
      schema: 'eu_west_server_public',
    })
  }
  return QuestionSetResultEuWest
}
