'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'questionText', // name of the key we're adding 
      {
        type: Sequelize.TEXT
      }
    )
    return queryInterface.changeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'answerExplanation', // name of the key we're adding 
      {
        type: Sequelize.TEXT
      }
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'questionText', // name of the key we're adding 
      {
        type: Sequelize.STRING
      }
    )
    return queryInterface.changeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'answerExplanation', // name of the key we're adding 
      {
        type: Sequelize.STRING
      }
    )
  }
};