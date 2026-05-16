'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'DicomFileSets',
      'flipSagittal',
      {
        type: Sequelize.BOOLEAN
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'DicomFileSets',
      'flipSagittal'
    )
  }
};