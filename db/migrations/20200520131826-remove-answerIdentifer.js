'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'answerIdentifier', // key we want to remove
    )
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'MultipleChoiceQuestions',
      'answerIdentifier',
      {
        type: Sequelize.STRING
      })
  }
};