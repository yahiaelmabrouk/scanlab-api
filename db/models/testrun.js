'use strict'
module.exports = (sequelize, DataTypes) => {
  const TestRun = sequelize.define(
    'TestRun',
    {
      userId: DataTypes.INTEGER,
      questions: DataTypes.JSON,
      answers: DataTypes.JSON,
      timeStarted: DataTypes.DATE,
      timeEnded: DataTypes.DATE,
      secondsActive: DataTypes.INTEGER,
      isSandbox: DataTypes.BOOLEAN,
      score: DataTypes.DECIMAL(5, 2),
      patientPrepScore: DataTypes.DECIMAL(5, 2),
      patientPrepScores: DataTypes.JSON,
      questionSetScore: DataTypes.DECIMAL(5, 2),
      preparedExamId: DataTypes.INTEGER,
      bodyPartId: DataTypes.INTEGER,
      softwareVendor: DataTypes.STRING,
      softwareVersion: DataTypes.STRING,
    },
    {}
  )
  TestRun.associate = function (models) {
    // associations can be defined here
    TestRun.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    TestRun.hasMany(models.QuestionSetResult, { as: 'questionSetResults', foreignKey: 'testRunId' })
    TestRun.hasMany(models.MultipleChoiceQuestionResult, {
      as: 'multipleChoiceQuestionResults',
      foreignKey: 'testRunId',
    })
  }
  return TestRun
}
