'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'DicomFileSets',
      'userViewOnlyAllowed',
      {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    );
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn(
      'DicomFileSets', // name of Source model
      'userViewOnlyAllowed', // key we want to remove
    )
  }
};
