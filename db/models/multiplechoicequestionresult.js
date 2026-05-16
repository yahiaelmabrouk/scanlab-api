'use strict'
module.exports = (sequelize, DataTypes) => {
  const MultipleChoiceQuestionResult = sequelize.define(
    'MultipleChoiceQuestionResult',
    {
      answer: DataTypes.STRING,
      score: DataTypes.DECIMAL(5, 2),
    },
    {}
  )
  MultipleChoiceQuestionResult.associate = function (models) {
    MultipleChoiceQuestionResult.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    MultipleChoiceQuestionResult.belongsTo(models.TestRun, {
      as: 'testRun',
      foreignKey: 'testRunId',
      onDelete: 'CASCADE',
    })
    MultipleChoiceQuestionResult.belongsTo(models.MultipleChoiceQuestion, {
      as: 'multipleChoiceQuestion',
      foreignKey: 'multipleChoiceQuestionId',
    })
  }
  return MultipleChoiceQuestionResult
}
