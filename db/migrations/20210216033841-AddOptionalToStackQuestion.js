'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('StackQuestions', 'freebie', {
      type: Sequelize.BOOLEAN,
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('StackQuestions', 'freebie')
  },
}
