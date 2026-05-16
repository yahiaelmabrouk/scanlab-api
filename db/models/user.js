'use strict'
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      // region: {
      //   allowNull: false,
      //   type: DataTypes.STRING,
      //   defaultValue: 'us_east',
      //   validate: {
      //     notEmpty: true,
      //   },
      // },
      vendorStylePreference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      fieldStrengthPreference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      defaultLanguageCode: {
        type: DataTypes.STRING,
        defaultValue: 'en',
      },
      softwareVendorPreference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      softwareVersionPreference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sliceFrameRate: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      scientificMode: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      passHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      legalName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nickName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      language: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastIP: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      minJWTGeneratedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      injectionMode: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
      },
      injectCondition: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      defaultContrastOnlyProtocol: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
      },
      defaultContrastAndSalineProtocol: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      sliceExpansionBehavior: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      preferredAnswerCriteriaByStackQuestionId: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      preferredTimingMethod: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      emailVerifyToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      emailVerifyTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {}
  )
  User.associate = function (models) {
    User.hasOne(models.UserInformation, {
      as: 'userInfo',
      foreignKey: 'userId',
    })
    User.hasOne(models.UserInformationEuWest, {
      as: 'userInfoEuWest',
      foreignKey: 'userId',
    })

    // associations can be defined here
    User.hasMany(models.TestRun, { as: 'testRuns', foreignKey: 'userId' })
    User.hasMany(models.QuestionSetResult, { as: 'questionSetResults', foreignKey: 'userId' })
    User.hasMany(models.MultipleChoiceQuestionResult, { as: 'multipleChoiceQuestionResults', foreignKey: 'userId' })
    User.hasMany(models.CohortManager, { as: 'cohortManagers', foreignKey: 'userId' })
    User.hasMany(models.CohortStudent, { as: 'cohortStudents', foreignKey: 'userId' })
    User.hasMany(models.Role, { as: 'roles', foreignKey: 'userId' })
    User.hasOne(models.RegistrationCode, { as: 'registrationCode', foreignKey: 'userId' })
  }
  return User
}
