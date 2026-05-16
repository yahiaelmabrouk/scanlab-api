'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Regions', [{
      name: 'Head (Contrast Lab)',
      id: 9,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
    await queryInterface.sequelize.query(`ALTER SEQUENCE "Regions_id_seq" RESTART WITH 10;`)

    await queryInterface.bulkInsert('BodyParts', [{
      name: 'Brain (Contrast Lab)',
      id: 100,
      regionId: 9,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
    return queryInterface.sequelize.query(`ALTER SEQUENCE "BodyParts_id_seq" RESTART WITH 101;`)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', { name: 'Brain (Contrast Lab)' }, {})
    await queryInterface.sequelize.query(`ALTER SEQUENCE "BodyParts_id_seq" RESTART WITH 99;`)
    await queryInterface.bulkDelete('Regions', { name: 'Head (Contrast Lab)' }, {})
    return queryInterface.sequelize.query(`ALTER SEQUENCE "Regions_id_seq" RESTART WITH 9;`)
  }
};
