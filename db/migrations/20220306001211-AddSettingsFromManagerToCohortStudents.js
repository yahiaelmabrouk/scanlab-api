'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('CohortStudents', 'settingsFromManager', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('CohortStudents', 'settingsFromManager')
  },
}
