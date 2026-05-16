'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addIndex('Roles', ['name', 'userId'], { unique: true })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('Roles', ['name', 'userId'])
  },
}
