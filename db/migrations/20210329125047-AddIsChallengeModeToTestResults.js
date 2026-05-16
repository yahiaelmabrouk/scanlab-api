'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('QuestionSetResults', 'isChallengeMode', {
      type: Sequelize.BOOLEAN,
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('QuestionSetResults', 'isChallengeMode')
  },
}
