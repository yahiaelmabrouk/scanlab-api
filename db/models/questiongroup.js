'use strict'

module.exports = (sequelize, DataTypes) => {
  const QuestionGroup = sequelize.define(
    'QuestionGroup',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('pre', 'post'),
        allowNull: false,
      },
      questionIds: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        defaultValue: [],
        comment: 'Array of IDs referencing individual questions in this group',
      },
    },
    {}
  )

  QuestionGroup.associate = function (models) {
    QuestionGroup.hasMany(models.PreparedExam, {
      foreignKey: 'postQuestionGroupId',
      as: 'PreparedExamPost',
    })
    QuestionGroup.hasMany(models.PreparedExam, {
      foreignKey: 'preQuestionGroupId',
      as: 'PreparedExamPre',
    })
  }

  return QuestionGroup
}
