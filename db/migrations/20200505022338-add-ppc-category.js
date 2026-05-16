'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Categories', [{
      name: 'Patient Preperation and Care',
      id: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    return queryInterface.sequelize.query(`ALTER SEQUENCE "Categories_id_seq" RESTART WITH 7;`)
  },

  down: async (queryInterface, Sequelize) => {
    
  }
};
