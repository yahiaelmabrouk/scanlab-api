'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'MultipleChoiceQuestionResults', // name of Source model
      'answer',
      {
        type: Sequelize.TEXT
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'MultipleChoiceQuestionResults', // name of Source model
      'answer',
      {
        type: Sequelize.STRING
      }
    )
  }
};
