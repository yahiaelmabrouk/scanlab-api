'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'StackQuestions',
      'initialSelection',
      {
        type: Sequelize.JSON
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'initialSelection', // key we want to remove
    )
  }
};