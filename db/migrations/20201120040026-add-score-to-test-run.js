'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TestRuns', 'score', {
      type: Sequelize.DECIMAL(5, 2)
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('TestRuns', 'score')
  }
};
