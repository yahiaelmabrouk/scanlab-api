'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionMiscDocument = sequelize.define(
    'QuestionMiscDocument',
    {
      alt: DataTypes.STRING,
      pathKey: DataTypes.STRING,
      filename: DataTypes.STRING,
      type: DataTypes.STRING, //mime type
    },
    {}
  )
  QuestionMiscDocument.associate = function (models) {
    // associations can be defined here
    QuestionMiscDocument.belongsTo(models.MultipleChoiceQuestion, {
      as: 'multipleChoiceQuestion',
      foreignKey: 'multipleChoiceQuestionId',
    })
  }
  return QuestionMiscDocument
}
