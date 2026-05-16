'use strict'
module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      name: DataTypes.STRING,
    },
    {}
  )
  Role.associate = function (models) {
    Role.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
  }
  return Role
}
