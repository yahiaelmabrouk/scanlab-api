'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async function(transaction) {
      await queryInterface.bulkDelete(
        'StackQuestions', // name of Source model
        {});

      await queryInterface.addColumn(
        'StackQuestions', // name of Source model
        'questionSet', // name of the key we're adding
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'QuestionSets', // name of Target model
            key: 'id', // key in Target model that we're referencing
          },
        }
      );

      return queryInterface.addIndex('StackQuestions', ['questionSet'], {unique: false});
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'questionSet', // key we want to remove
    )
  }
};
