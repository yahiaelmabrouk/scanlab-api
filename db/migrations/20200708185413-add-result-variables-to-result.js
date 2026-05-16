'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'StackQuestionResults',
      'scoreVariables',
      {
        allowNull: false,
        type: Sequelize.JSONB,
        defaultValue: {}
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'scoreVariables', // key we want to remove
    )
  }
};
