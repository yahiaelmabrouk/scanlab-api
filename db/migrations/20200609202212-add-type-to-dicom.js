'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'DicomFileSets', // name of Source model
      'type', // name of the key we're adding
      {
        type: Sequelize.STRING
      },
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'DicomFileSets', // name of Source model
      'type', // key we want to remove
    )
  }
};
