'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Categories', [{
      name: 'Artifacts',
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Pathology',
      id: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Safety',
      id: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Parameters and Trade-offs',
      id: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Patient Care',
      id: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Anatomy',
      id: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    return queryInterface.sequelize.query(`ALTER SEQUENCE "Categories_id_seq" RESTART WITH 6;`)
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Categories', null, {});
  }
};
