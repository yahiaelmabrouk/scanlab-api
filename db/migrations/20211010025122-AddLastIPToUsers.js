'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('Users', 'lastIP', {
      allowNull: true,
      type: Sequelize.STRING,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'lastIP')
  },
}
