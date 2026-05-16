'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('MultipleChoiceQuestions', 'globalQuestion', {
      allowNull: false,
      defaultValue: false,
      type: Sequelize.BOOLEAN,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('MultipleChoiceQuestions', 'globalQuestion')
  },
}
