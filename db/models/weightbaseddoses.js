'use strict'
module.exports = (sequelize, DataTypes) => {
  const WeightBasedDose = sequelize.define(
    'WeightBasedDose',
    {
      weightMetric: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      contrastDose: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      rate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {}
  )
  WeightBasedDose.associate = function () {}
  return WeightBasedDose
}
