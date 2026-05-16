'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('BodyParts', [{
      name: 'Pituitary',
      regionId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    return queryInterface.sequelize.query(`ALTER SEQUENCE "BodyParts_id_seq" RESTART WITH 10;`)
  },

  down: async (queryInterface, Sequelize) => {
    
  }
};
