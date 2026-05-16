'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('TestRuns', 'bodyPartId', {
      allowNull: true,
      defaultValue: null,
      type: Sequelize.INTEGER,
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('TestRuns', 'bodyPartId')
  }
};
