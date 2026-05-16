'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('MultipleChoiceQuestions', 'secondsToAnswer', {
      allowNull: false,
      defaultValue: 45,
      type: Sequelize.INTEGER,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('MultipleChoiceQuestions', 'secondsToAnswer')
  },
}
