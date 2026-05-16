'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Regions',
      [
        {
          name: 'Angiography',
          id: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
    await queryInterface.sequelize.query(`ALTER SEQUENCE "Regions_id_seq" RESTART WITH 11;`)
    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Carotid Arteries',
          id: 101,
          regionId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Thoracic Aorta',
          id: 102,
          regionId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Pulmonary Arteries',
          id: 103,
          regionId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Left Atrium (Ablation)',
          id: 104,
          regionId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Renal Arteries',
          id: 105,
          regionId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
    return queryInterface.sequelize.query(`ALTER SEQUENCE "BodyParts_id_seq" RESTART WITH 106;`)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', {name: 'Renal Arteries'}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Left Atrium (Ablation)'}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Pulmonary Arteries'}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Thoracic Aorta'}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Carotid Arteries'}, {})
    await queryInterface.sequelize.query(`ALTER SEQUENCE "BodyParts_id_seq" RESTART WITH 100;`)

    await queryInterface.bulkDelete('Regions', {name: 'Angiography'}, {})
    return queryInterface.sequelize.query(`ALTER SEQUENCE "Regions_id_seq" RESTART WITH 10;`)
  },
}
