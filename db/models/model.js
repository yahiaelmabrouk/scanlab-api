'use strict'
module.exports = (sequelize, DataTypes) => {
  const Model = sequelize.define(
    'Model',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      to: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      weightImperial: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      weightMetric: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      heightImperial: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      heightMetric: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      heightInches: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      attributes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {}
  )
  Model.associate = function (models) {
    Model.hasMany(models.BodyBox, { as: 'bodyBoxes', foreignKey: 'patientPositionId' })
  }
  return Model
}
