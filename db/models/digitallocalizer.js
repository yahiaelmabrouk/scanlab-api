'use strict'
module.exports = (sequelize, DataTypes) => {
  const DigitalLocalizer = sequelize.define(
    'DigitalLocalizer',
    {
      bodyPartId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      minStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 339,
      },
    },
    {}
  )
  DigitalLocalizer.associate = function (models) {
    DigitalLocalizer.belongsTo(models.BodyPart, { as: 'bodyPart', foreignKey: 'bodyPartId' })
  }
  return DigitalLocalizer
}
