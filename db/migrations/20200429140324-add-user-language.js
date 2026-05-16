'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Users',
      'language',
      {
        type: Sequelize.STRING
      })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Users', // name of Source model
      'language', // key we want to remove
    )
  }
};