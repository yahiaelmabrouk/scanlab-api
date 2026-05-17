'use strict'
module.exports = (sequelize, DataTypes) => {
  const UserInformationEuWest = sequelize.define(
    'UserInformationEuWest',
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
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
      lastIPs: {
        type: DataTypes.JSON,
        defaultValue: [],
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
        defaultValue: 1,
      },
      defaultContrastAndSalineProtocol: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
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
      settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: 'UserInformations',
      schema: 'eu_west_server_public', // Specify the schema here
      timestamps: true,
    }
  )

  UserInformationEuWest.associate = function (models) {
    // Quan hệ 1-1 với User
    UserInformationEuWest.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId',
    })
  }

  return UserInformationEuWest
}
