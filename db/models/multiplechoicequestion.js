'use strict'

module.exports = (sequelize, DataTypes) => {
  const MultipleChoiceQuestion = sequelize.define(
    'MultipleChoiceQuestion',
    {
      questionText: DataTypes.STRING,
      difficulty: DataTypes.INTEGER,
      choices: DataTypes.JSON,
      answerExplanation: DataTypes.STRING,
      type: DataTypes.STRING,
      range: DataTypes.JSON,
      onlyForPreparedExams: DataTypes.BOOLEAN,
      globalQuestion: DataTypes.BOOLEAN,
      hideQuestion: DataTypes.BOOLEAN,
      secondsToAnswer: DataTypes.INTEGER,
      isGeneralQuestion: DataTypes.BOOLEAN,
      keepOrder: DataTypes.BOOLEAN,
      isBetaQuestion: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      betaQuestionAttempts: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      screeningForm: {
        allowNull: false,
        type: DataTypes.JSONB,
        defaultValue: {},
      },
    },
    {}
  )
  MultipleChoiceQuestion.associate = function (models) {
    MultipleChoiceQuestion.belongsTo(models.Category, { as: 'category', foreignKey: 'categoryId' })
    MultipleChoiceQuestion.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
    MultipleChoiceQuestion.hasMany(models.MultipleChoiceQuestionResult, {
      as: 'multipleChoiceQuestionResults',
      foreignKey: 'multipleChoiceQuestionId',
    })
    MultipleChoiceQuestion.hasMany(models.QuestionMiscDocument, {
      as: 'questionMiscDocuments',
      foreignKey: 'multipleChoiceQuestionId',
    })
  }
  return MultipleChoiceQuestion
}
