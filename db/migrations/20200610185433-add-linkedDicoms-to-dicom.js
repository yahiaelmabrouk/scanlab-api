'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'DicomFileSets', // name of Source model
      'linkedDicoms', // name of the key we're adding
      {
        type: Sequelize.JSON
      },
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'DicomFileSets', // name of Source model
      'linkedDicoms', // key we want to remove
    )
  }
};
