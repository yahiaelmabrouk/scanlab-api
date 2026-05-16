'use strict'
module.exports = (sequelize, DataTypes) => {
  const Region = sequelize.define(
    'Region',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      anatomicalOrder: {
        type: DataTypes.INTEGER,
        unique: true,
      },
    },
    {}
  )
  Region.associate = function (models) {
    Region.hasMany(models.BodyPart, { as: 'bodyParts', foreignKey: 'regionId' })
  }
  return Region
}
