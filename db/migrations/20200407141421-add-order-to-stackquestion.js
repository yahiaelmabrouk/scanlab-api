'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async function(transaction) {
      return queryInterface.addColumn(
        'StackQuestions',
        'order',
        {
          type: Sequelize.INTEGER
        }
      );
    })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'order', // key we want to remove
    )
  }
};
