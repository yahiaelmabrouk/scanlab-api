'use strict'
module.exports = (sequelize, DataTypes) => {
  const PatientPhysioCardiacLevel = sequelize.define(
    'PatientPhysioCardiacLevel',
    {
      levelType: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cardiacCycleDuration: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      cardiacCycleDeviation: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      badBeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      badBeatsDuration: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      continuousECGData: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {}
  )
  PatientPhysioCardiacLevel.associate = function (models) {
    PatientPhysioCardiacLevel.belongsTo(models.PatientPhysio, { as: 'patientPhysio', foreignKey: 'patientPhysioId' })
  }
  return PatientPhysioCardiacLevel
}
