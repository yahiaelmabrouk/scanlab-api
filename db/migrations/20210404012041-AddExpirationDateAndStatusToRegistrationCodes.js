'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('RegistrationCodes', 'expirationDate', {
      type: Sequelize.DATE,
    })
    await queryInterface.addColumn('RegistrationCodes', 'status', {
      allowNull: false,
      type: Sequelize.ENUM('active', 'disabled'),
      defaultValue: 'active',
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('RegistrationCodes', 'expirationDate')
    await queryInterface.removeColumn('RegistrationCodes', 'status')
  },
}
