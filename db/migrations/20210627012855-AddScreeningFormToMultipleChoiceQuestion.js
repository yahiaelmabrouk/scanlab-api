'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('MultipleChoiceQuestions', 'screeningForm', {
      allowNull: false,
      type: Sequelize.JSONB,
      defaultValue: {}
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('MultipleChoiceQuestions', 'screeningForm')
  },
}
