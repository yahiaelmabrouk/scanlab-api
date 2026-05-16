'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async function(transaction) {
      return queryInterface.addColumn(
        'DicomFileSets',
        'regionId',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Regions', // name of Target model
            key: 'id', // key in Target model that we're referencing
          },
        }
      );
    })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'DicomFileSets', // name of Source model
      'regionId', // key we want to remove
    )
  }
};
