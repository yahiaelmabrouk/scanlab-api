'use strict'
module.exports = (sequelize, DataTypes) => {
  const PreparedExam = sequelize.define(
    'PreparedExam',
    {
      title: DataTypes.TEXT,
      published: DataTypes.BOOLEAN,
      isSkill: DataTypes.BOOLEAN,
      isHiring: DataTypes.BOOLEAN,
      isDynamic: DataTypes.BOOLEAN,
      regionId: DataTypes.INTEGER,
      bodyPartId: DataTypes.INTEGER,
      postQuestionCount: DataTypes.INTEGER,
      postQuestionBodyPartCount: DataTypes.INTEGER,
      questions: {
        allowNull: false,
        type: DataTypes.JSONB,
        defaultValue: {
          preTestQuestions: [],
          questionSetId: null,
          postTestQuestions: [],
        },
      },
      postQuestionGroupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      preQuestionGroupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      patientPhysioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {}
  )

  PreparedExam.associate = function (models) {
    PreparedExam.belongsTo(models.QuestionGroup, {
      foreignKey: 'postQuestionGroupId',
      as: 'postQuestionGroup',
    })
    PreparedExam.belongsTo(models.QuestionGroup, {
      foreignKey: 'preQuestionGroupId',
      as: 'preQuestionGroup',
    })
    PreparedExam.belongsTo(models.PatientPhysio, {
      foreignKey: 'patientPhysioId',
      as: 'patientPhysio',
    })
  }

  return PreparedExam
}
