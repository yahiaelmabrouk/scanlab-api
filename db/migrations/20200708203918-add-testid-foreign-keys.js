'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'QuestionSetResults',
      'testRunId',
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'TestRuns',
          key: 'id'
        },
      })

      return queryInterface.addColumn(
        'MultipleChoiceQuestionResults',
        'testRunId',
        {
          type: Sequelize.INTEGER,
          references: {
            model: 'TestRuns',
            key: 'id'
          },
        })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'QuestionSetResults', // name of Source model
      'testRunId', // key we want to remove
    )

    return queryInterface.removeColumn(
      'MultipleChoiceQuestionResults', // name of Source model
      'testRunId', // key we want to remove
    )
  }
};
