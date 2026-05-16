'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`UPDATE "Categories" SET name='Patient Screening' WHERE name='Safety'`);

    await queryInterface.bulkInsert('Categories', [{
      name: 'Safety',
      id: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Clinical Procedures',
      id: 9,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    ], {});

    // Remove Patient Care
    await queryInterface.bulkDelete('Categories', { id: 5 }, {})


    return queryInterface.sequelize.query(`ALTER SEQUENCE "Categories_id_seq" RESTART WITH 10;`)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Categories', { id: 8 }, {})
    await queryInterface.bulkDelete('Categories', { id: 9 }, {})

    await queryInterface.sequelize.query(`ALTER SEQUENCE "Categories_id_seq" RESTART WITH 8;`)

    await queryInterface.bulkInsert('Categories', [{
      name: 'Patient Care',
      id: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    ], {});


    return queryInterface.sequelize.query(`UPDATE "Categories" SET name='Safety' WHERE name='Patient Screening'`);
  }
};
