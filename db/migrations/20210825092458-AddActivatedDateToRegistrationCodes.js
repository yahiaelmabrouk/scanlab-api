'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('RegistrationCodes', 'activationDate', {
      type: Sequelize.DATE
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('RegistrationCodes', 'activationDate')
  },
}
