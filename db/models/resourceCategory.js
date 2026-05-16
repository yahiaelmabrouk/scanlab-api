'use strict'
module.exports = (sequelize, DataTypes) => {
  const ResourceCategory = sequelize.define(
    'ResourceCategory',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {}
  )
  ResourceCategory.associate = function (models) {
    ResourceCategory.hasMany(models.Resource, { as: 'resources', foreignKey: 'categoryId' })
  }
  return ResourceCategory
}
