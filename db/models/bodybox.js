'use strict'
module.exports = (sequelize, DataTypes) => {
  const BodyBox = sequelize.define(
    'BodyBox',
    {
      x: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      y: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      z: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      width: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      height: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      length: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      landmarkTolerance: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      landmarkToleranceBottom: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      landmarkToleranceVertical: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      bodyPartId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      bodyBoxDirection: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      mriUpDownPositionY: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {}
  )
  BodyBox.associate = function (models) {
    BodyBox.belongsTo(models.PatientPosition, { as: 'patientPosition', foreignKey: 'patientPositionId' })
    BodyBox.belongsTo(models.Model, { as: 'model', foreignKey: 'modelId' })
  }
  return BodyBox
}
