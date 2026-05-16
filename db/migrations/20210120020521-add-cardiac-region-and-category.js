'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Categories',
      [
        {
          name: 'Cardiac',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )

    await queryInterface.bulkInsert(
      'Regions',
      [
        {
          name: 'Cardiac',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )

    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 11 WHERE name = \'Lower Extremities\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 10 WHERE name = \'Pelvis\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 9 WHERE name = \'Abdomen\'')
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 8 WHERE name = \'Cardiac\'')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Categories', {name: 'Cardiac'}, {})
    await queryInterface.bulkDelete('Regions', {name: 'Cardiac'}, {})
  },
};
