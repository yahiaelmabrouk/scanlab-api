'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'QuestionSetResults', // name of Source model
      'questionSetId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'QuestionSetResults', // name of Source model
      'questionSetId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
      }
    );
  }
};