'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Regions', [{
      name: 'Head',
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Neck',
      id: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Spine',
      id: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Upper Extremities',
      id: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Thorax',
      id: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Abdomen',
      id: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Pelvis',
      id: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Lower Extremities',
      id: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    await queryInterface.sequelize.query(`ALTER SEQUENCE "Regions_id_seq" RESTART WITH 9;`)

    await queryInterface.bulkInsert('BodyParts', [{
      name: 'Brain',
      regionId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Orbits',
      regionId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'IACs',
      regionId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'TMJ',
      regionId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Soft Tissue Neck',
      regionId: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Brachial Plexus',
      regionId: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Cervical',
      regionId: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Thoracic',
      regionId: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Lumbar',
      regionId: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Shoulder',
      regionId: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Elbow',
      regionId: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Wrist',
      regionId: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Hand',
      regionId: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Fingers',
      regionId: 4,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Cardiac',
      regionId: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Liver',
      regionId: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Kidneys',
      regionId: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Boney Pelvis',
      regionId: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Female Pelvis',
      regionId: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Hips',
      regionId: 7,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Knee',
      regionId: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Ankle',
      regionId: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Foot',
      regionId: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Toes',
      regionId: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', null, {});
    return queryInterface.bulkDelete('Regions', null, {});
  }
};
