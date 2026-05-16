'use strict'
module.exports = (sequelize, DataTypes) => {
  const MultipleChoiceQuestionResultEuWest = sequelize.define(
    'MultipleChoiceQuestionResultEuWest',
    {
      answer: DataTypes.STRING,
      score: DataTypes.DECIMAL(5, 2),
      userId: DataTypes.INTEGER, // Foreign key to User
      testRunId: DataTypes.INTEGER, // Foreign key to TestRun
      multipleChoiceQuestionId: DataTypes.INTEGER, // Foreign key to MultipleChoiceQuestion
    },
    {
      schema: 'eu_west_server_public', // Specify the schema here
      tableName: 'MultipleChoiceQuestionResults', // Optional: explicitly set table name (useful if it differs from model name)
    }
  )
  MultipleChoiceQuestionResultEuWest.associate = function (models) {
    MultipleChoiceQuestionResultEuWest.belongsTo(models.TestRunEuWest, {
      as: 'testRun',
      foreignKey: 'testRunId',
      onDelete: 'CASCADE',
      schema: 'eu_west_server_public',
    })
    MultipleChoiceQuestionResultEuWest.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    MultipleChoiceQuestionResultEuWest.belongsTo(models.MultipleChoiceQuestion, {
      as: 'multipleChoiceQuestion',
      foreignKey: 'multipleChoiceQuestionId',
    })
  }
  return MultipleChoiceQuestionResultEuWest
}
