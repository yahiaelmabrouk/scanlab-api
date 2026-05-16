'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('TestRuns', 'preparedExamId', {
      allowNull: true,
      defaultValue: null,
      type: Sequelize.INTEGER,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('TestRuns', 'preparedExamId')
  },
}
