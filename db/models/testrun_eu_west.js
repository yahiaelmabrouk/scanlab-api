'use strict'
module.exports = (sequelize, DataTypes) => {
  const TestRunEuWest = sequelize.define(
    'TestRunEuWest',
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
    {
      schema: 'eu_west_server_public', // Specify the schema here
      tableName: 'TestRuns', // Optional: explicitly set table name (useful if it differs from model name)
      timestamps: true,
    }
  )
  TestRunEuWest.associate = function (models) {
    TestRunEuWest.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    TestRunEuWest.hasMany(models.QuestionSetResultEuWest, { as: 'questionSetResults', foreignKey: 'testRunId' })
    TestRunEuWest.hasMany(models.MultipleChoiceQuestionResultEuWest, {
      as: 'multipleChoiceQuestionResults',
      foreignKey: 'testRunId',
      schema: 'eu_west_server_public',
    })
  }
  return TestRunEuWest
}
