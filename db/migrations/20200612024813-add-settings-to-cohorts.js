'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Cohorts',
      'settings',
      {
        allowNull: false,
        type: Sequelize.JSONB,
        defaultValue: {}
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Cohorts', // name of Source model
      'settings', // key we want to remove
    )
  }
};
