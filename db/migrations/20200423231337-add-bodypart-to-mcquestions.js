'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'MultipleChoiceQuestions',
      'bodyPartId',
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'BodyParts',
          key: 'id'
        },
      })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'bodyPartId', // key we want to remove
    )
  }
};