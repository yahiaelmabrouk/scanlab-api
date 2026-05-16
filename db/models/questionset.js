'use strict'
module.exports = (sequelize, DataTypes) => {
  const QuestionSet = sequelize.define(
    'QuestionSet',
    {
      name: DataTypes.STRING,
      isAvailable: DataTypes.BOOLEAN,
      isUltraLab: DataTypes.BOOLEAN,
      isPreparedExamOnly: DataTypes.BOOLEAN,
      rarity: DataTypes.STRING,
      ageFrom: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ageTo: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {}
  )
  QuestionSet.associate = function (models) {
    // 1 QuestionSet has MANY StackQuestions.. inverse of belongsto
    QuestionSet.hasMany(models.QuestionSetResult, { as: 'questionSetResults', foreignKey: 'questionSetId' })
    QuestionSet.hasMany(models.StackQuestion, { as: 'stackQuestions', foreignKey: 'questionSet' })
    QuestionSet.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
    QuestionSet.belongsTo(models.DicomFileSet, { foreignKey: 'dicomFileSet' })
  }
  return QuestionSet
}
