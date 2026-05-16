'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    await queryInterface.sequelize.query('UPDATE "MultipleChoiceQuestionResults" SET score = correct::int * 100')

    await queryInterface.changeColumn('MultipleChoiceQuestionResults', 'score', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      default: 0.0,
    })
  },

  down: async (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    await queryInterface.sequelize.query('UPDATE "MultipleChoiceQuestionResults" SET score = 0.0')
    await queryInterface.changeColumn('MultipleChoiceQuestionResults', 'score', {
      type: Sequelize.DECIMAL(5, 2),
    })
  },
}
