'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('RegistrationCodes', 'userId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'Users',
        key: 'id',
      },
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('RegistrationCodes', 'userId')
  },
}
