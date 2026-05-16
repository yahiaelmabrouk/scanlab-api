'use strict'
module.exports = (sequelize, DataTypes) => {
  const Language = sequelize.define(
    'Language',
    {
      code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      content: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      flag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {}
  )
  return Language
}
