'use strict'
module.exports = (sequelize, DataTypes) => {
  const Cohort = sequelize.define(
    'Cohort',
    {
      name: {
        allowNull: false,
        type: DataTypes.STRING,
        validate: {
          notEmpty: true,
        },
      },
      area: {
        allowNull: false,
        type: DataTypes.STRING,
        defaultValue: 'us_east',
      },
      availableRegistrationCodesCount: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      studentsCount: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      settings: {
        allowNull: false,
        defaultValue: {},
        type: DataTypes.JSONB,
      },
      adminSettings: {
        allowNull: false,
        defaultValue: {
          isActive: true,
          isPlaygroundEnabled: false,
          isRandomModeEnabled: false,
          isChallengeModeEnabled: false,
          isTestByRegionEnabled: true,
          amountOfCriticalThinkingQuestionsPerTestRun: 4,
          isUltraLabEnabled: true,
        },
        type: DataTypes.JSONB,
      },
      expirationLength: {
        defaultValue: '365',
        type: DataTypes.STRING,
      },
    },
    {}
  )
  Cohort.associate = function (models) {
    Cohort.hasMany(models.CohortManager, { as: 'CohortManagers', foreignKey: 'cohortId' })
    Cohort.hasMany(models.CohortStudent, { as: 'CohortStudents', foreignKey: 'cohortId' })
    Cohort.hasMany(models.RegistrationCode, { as: 'RegistrationCodes', foreignKey: 'cohortId' })
    Cohort.hasMany(models.CohortPreparedExam, { as: 'cohortPreparedExams', foreignKey: 'cohortId' })
  }
  return Cohort
}
