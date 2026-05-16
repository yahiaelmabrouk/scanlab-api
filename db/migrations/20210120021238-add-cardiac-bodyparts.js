'use strict';

const { Region } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {

    let region = await Region.findOne({where: {name: 'Cardiac'}})

    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Left Ventricular',
          regionId: region.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Left+Right Ventricular',
          regionId: region.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', {name: 'Left Ventricular'}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Left+Right Ventricular'}, {})
  }
};
