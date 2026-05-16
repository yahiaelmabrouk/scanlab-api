'use strict'
module.exports = (sequelize, DataTypes) => {
  const PatientPosition = sequelize.define(
    'PatientPosition',
    {
      value: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      isShowHeadHolder: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {}
  )
  PatientPosition.associate = function (models) {
    PatientPosition.belongsTo(models.PatientPositionSet, { as: 'patientPositionSet', foreignKey: 'positionSetId' })
    PatientPosition.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
    PatientPosition.hasMany(models.BodyBox, { as: 'bodyBoxes', foreignKey: 'patientPositionId' })
  }
  return PatientPosition
}
