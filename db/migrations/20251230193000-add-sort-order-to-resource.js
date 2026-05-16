'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'Resources',
        'sortOrder',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        { transaction }
      )

      await queryInterface.sequelize.query('UPDATE "Resources" SET "sortOrder" = "id" WHERE "sortOrder" = 0', {
        transaction,
      })
    })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Resources', 'sortOrder')
  },
};
