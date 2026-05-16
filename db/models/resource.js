'use strict'
module.exports = (sequelize, DataTypes) => {
  const Resource = sequelize.define(
    'Resource',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      language: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {}
  )
  Resource.associate = function (models) {
    // associations can be defined here
    Resource.belongsTo(models.ResourceCategory, { as: 'resourceCategory', foreignKey: 'categoryId' })
  }
  return Resource
}
