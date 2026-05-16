'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return await queryInterface.removeColumn('MultipleChoiceQuestionResults', 'correct')
  },

  down: async (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    await queryInterface.addColumn('MultipleChoiceQuestionResults', 'correct', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    })

    return await queryInterface.sequelize.query('UPDATE "MultipleChoiceQuestionResults" SET correct = (score > 0)')
  }
};
