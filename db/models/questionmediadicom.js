'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionMediaDicom = sequelize.define(
    'QuestionMediaDicom',
    {
      questionMediaId: DataTypes.INTEGER,
      dicomFileSetId: DataTypes.INTEGER,
    },
    {}
  )
  QuestionMediaDicom.associate = function (models) {
    // associations can be defined here
    QuestionMediaDicom.belongsTo(models.QuestionMedia, { as: 'questionMedia', foreignKey: 'questionMediaId' })
    QuestionMediaDicom.hasOne(models.DicomFileSet, { as: 'dicomFileSet', foreignKey: 'id' })
  }
  return QuestionMediaDicom
}
