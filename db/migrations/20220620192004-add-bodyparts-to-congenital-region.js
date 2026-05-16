'use strict';

const { Region } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let region = await Region.findOne({where: {name: 'Congenital'}})

    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Left Ventricular - Congenital',
          regionId: region.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Left+Right Ventricular - Congenital',
          regionId: region.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, Sequelize) => {
    let region = await Region.findOne({where: {name: 'Congenital'}})
    await queryInterface.bulkDelete('BodyParts', {name: 'Left Ventricular - Congenital', regionId: region.id}, {})
    await queryInterface.bulkDelete('BodyParts', {name: 'Left+Right Ventricular - Congenital', regionId: region.id}, {})
  }
};
