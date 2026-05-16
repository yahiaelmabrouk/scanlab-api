'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'MultipleChoiceQuestions',
      'difficulty',
      {
        type: Sequelize.INTEGER
      })
    return queryInterface.addColumn(
      'StackQuestions',
      'difficulty',
      {
        type: Sequelize.INTEGER
      })
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'difficulty', // key we want to remove
    )
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'difficulty', // key we want to remove
    )
  }
};