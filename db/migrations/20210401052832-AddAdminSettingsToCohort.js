'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Cohorts', 'adminSettings', {
        allowNull: false,
        type: Sequelize.JSONB,
        defaultValue: {}
      })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Cohorts', 'adminSettings')
  },
};
