'use strict'
module.exports = (sequelize, DataTypes) => {
  const CohortStudent = sequelize.define(
    'CohortStudent',
    {
      userId: {
        allowNull: true,
        type: DataTypes.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      cohortId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: 'Cohorts',
          key: 'id',
        },
      },
      settingsFromManager: {
        allowNull: false,
        type: DataTypes.JSON,
      },
      registrationCodeId: {
        allowNull: true,
        type: DataTypes.INTEGER,
        references: {
          model: 'RegistrationCodes',
          key: 'id',
        },
      },
    },
    {}
  )
  CohortStudent.associate = function (models) {
    CohortStudent.belongsTo(models.Cohort, { as: 'cohort', foreignKey: 'cohortId' })
    CohortStudent.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
    CohortStudent.belongsTo(models.RegistrationCode, { as: 'registrationCode', foreignKey: 'registrationCodeId' })
  }
  return CohortStudent
}
