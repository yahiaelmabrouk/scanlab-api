'use strict'
module.exports = (sequelize, DataTypes) => {
  const CohortAverageCache = sequelize.define(
    'CohortAverageCache',
    {
      cohortId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Cohorts',
          key: 'id',
        },
      },
      angleAverage: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      wastedSlicesAverage: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      lastUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      lastUsed: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'CohortAverageCache',
      timestamps: false,
    }
  )

  CohortAverageCache.associate = function (models) {
    CohortAverageCache.belongsTo(models.Cohort, { as: 'cohort', foreignKey: 'cohortId' })
  }

  return CohortAverageCache
}
