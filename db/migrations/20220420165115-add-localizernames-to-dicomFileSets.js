'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'DicomFileSets',
      'localizerNames',
      {
        allowNull: true,
        type: Sequelize.JSONB,
        defaultValue: {}
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('DicomFileSets', 'localizerNames')
  }
};
