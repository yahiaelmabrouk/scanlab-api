'use strict'
module.exports = (sequelize, DataTypes) => {
  const PatientPhysio = sequelize.define(
    'PatientPhysio',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      respiratoryCycleDuration: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      strokeVol: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 40,
      },
      difficulty: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      breathHoldDuration: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      unit: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {}
  )
  PatientPhysio.associate = function (models) {
    PatientPhysio.hasMany(models.PatientPhysioCardiacLevel, { as: 'cardiacLevels', foreignKey: 'patientPhysioId' })
    PatientPhysio.hasMany(models.PreparedExam, { as: 'preparedExams', foreignKey: 'patientPhysioId' })
  }
  return PatientPhysio
}
