'use strict'
module.exports = (sequelize, DataTypes) => {
  const InjectionAttribute = sequelize.define(
    'InjectionAttribute',
    {
      contrastMinDose: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      contrastMaxDose: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      contrastMinFlowRate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      contrastMaxFlowRate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      salineMinDose: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      salineMaxDose: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      salineMinFlowRate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      salineMaxFlowRate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      minTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      maxTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      bodyPartId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      posts: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {}
  )
  InjectionAttribute.associate = function (models) {
    InjectionAttribute.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
  }
  return InjectionAttribute
}
