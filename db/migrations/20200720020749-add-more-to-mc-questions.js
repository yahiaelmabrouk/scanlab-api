'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('MultipleChoiceQuestions', 'type', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'MC',
    })

    return queryInterface.addColumn('MultipleChoiceQuestions', 'range', {
      allowNull: true,
      type: Sequelize.JSON
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'type' // key we want to remove
    )
    return queryInterface.removeColumn(
      'MultipleChoiceQuestions', // name of Source model
      'range' // key we want to remove
    )
  },
}
