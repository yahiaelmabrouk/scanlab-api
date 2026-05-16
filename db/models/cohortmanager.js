'use strict'
module.exports = (sequelize, DataTypes) => {
  const CohortManager = sequelize.define(
    'CohortManager',
    {
      cohortId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: 'Cohorts',
          key: 'id',
        },
      },
      userId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    },
    {}
  )
  CohortManager.associate = function (models) {
    CohortManager.belongsTo(models.Cohort, { as: 'cohort', foreignKey: 'cohortId' })
    CohortManager.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
  }
  return CohortManager
}
