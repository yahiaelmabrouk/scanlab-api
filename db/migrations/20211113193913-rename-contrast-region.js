'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query('UPDATE "Regions" SET "name" = \'Special\' WHERE id = 9') // Previously "Head (Contrast Lab)"
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query('UPDATE "Regions" SET "name" = \'Head (Contrast Lab)\' WHERE id = 9')
  },
}
