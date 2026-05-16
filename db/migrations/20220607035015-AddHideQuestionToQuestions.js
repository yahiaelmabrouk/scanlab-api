'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('MultipleChoiceQuestions', 'hideQuestion', {
      allowNull: false,
      defaultValue: false,
      type: Sequelize.BOOLEAN,
    })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('MultipleChoiceQuestions', 'hideQuestion')
  }
};
