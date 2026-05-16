'use strict'
module.exports = (sequelize, DataTypes) => {
  const PatientPositionSet = sequelize.define(
    'PatientPositionSet',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {}
  )
  PatientPositionSet.associate = function (models) {
    PatientPositionSet.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
    PatientPositionSet.hasMany(models.PatientPosition, { as: 'patientPositions', foreignKey: 'positionSetId' })
  }
  return PatientPositionSet
}
