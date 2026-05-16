'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionMedia = sequelize.define(
    'QuestionMedia',
    {
      multipleChoiceQuestionId: DataTypes.INTEGER,
    },
    {}
  )
  QuestionMedia.associate = function (models) {
    // associations can be defined here
    QuestionMedia.belongsTo(models.MultipleChoiceQuestion, {
      as: 'multipleChoiceQuestion',
      foreignKey: 'multipleChoiceQuestionId',
    })
    QuestionMedia.hasOne(models.QuestionMediaUpload, {
      as: 'questionMediaUpload',
      foreignKey: 'questionMediaId',
    })
    QuestionMedia.hasOne(models.QuestionMediaDicom, {
      as: 'questionMediaDicom',
      foreignKey: 'questionMediaId',
    })
  }
  return QuestionMedia
}
