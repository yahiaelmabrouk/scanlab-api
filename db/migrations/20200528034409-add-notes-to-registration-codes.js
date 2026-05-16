'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'RegistrationCodes', // name of Source model
      'notes', // name of the key we're adding
      {
        type: Sequelize.TEXT
      },
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'RegistrationCodes', // name of Source model
      'notes', // key we want to remove
    )
  }
};
