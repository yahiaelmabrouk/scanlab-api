'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async function(transaction) {
      await queryInterface.removeColumn(
        'QuestionSets', // name of Source model
        'bodyPart', // key we want to remove
      )
      return queryInterface.addColumn(
        'QuestionSets',
        'bodyPartId',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'BodyParts', // name of Target model
            key: 'id', // key in Target model that we're referencing
          },
        }
      );
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'QuestionSets',
      'bodyPart',
      {
        type: Sequelize.INTEGER
      }
    );

    return queryInterface.removeColumn(
      'QuestionSets', // name of Source model
      'bodyPartId', // key we want to remove
    )
  }
};
