'use strict'
module.exports = (sequelize, DataTypes) => {
  const RegistrationCode = sequelize.define(
    'RegistrationCode',
    {
      code: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      notes: {
        type: DataTypes.TEXT,
      },
      cohortId: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      expirationDate: {
        type: DataTypes.DATE,
      },
      activationDate: {
        type: DataTypes.DATE,
      },
      numOfDaysActive: {
        allowNull: false,
        defaultValue: 365,
        type: DataTypes.INTEGER,
      },
      userId: {
        type: DataTypes.INTEGER,
      },
      status: {
        allowNull: false,
        defaultValue: 'active',
        type: DataTypes.ENUM('active', 'disabled'),
      },
    },
    {}
  )
  RegistrationCode.associate = function (models) {
    RegistrationCode.belongsTo(models.Cohort, { as: 'cohort', foreignKey: 'cohortId' })
    RegistrationCode.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
  }
  return RegistrationCode
}
