'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'answer', // key we want to remove
    )
    return queryInterface.addColumn(
      'StackQuestionResults',
      'answer',
      {
        type: Sequelize.JSON
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'answer', // key we want to remove
    )
    return queryInterface.addColumn(
      'StackQuestionResults',
      'answer',
      {
        type: Sequelize.STRING
      }
    );
  }
};