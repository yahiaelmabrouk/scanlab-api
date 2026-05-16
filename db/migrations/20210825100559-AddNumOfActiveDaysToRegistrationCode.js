'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('RegistrationCodes', 'numOfDaysActive', {
      allowNull: false,
      defaultValue: 365,
      type: Sequelize.INTEGER,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('RegistrationCodes', 'numOfDaysActive')
  },
}
