'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Regions',
      [
        {
          name: 'Congenital',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 12 WHERE name = \'Lower Extremities\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 11 WHERE name = \'Pelvis\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 10 WHERE name = \'Abdomen\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 9 WHERE name = \'Congenital\'')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Regions', {name: 'Congenital'}, {})
  }
};
