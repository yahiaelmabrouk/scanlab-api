'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'TestRuns',
      'isSandbox',
      {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    );
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn(
      'TestRuns', // name of Source model
      'isSandbox', // key we want to remove
    )
  }
};
