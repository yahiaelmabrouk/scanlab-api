'use strict'

const { Region } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let regionSpecial = await Region.findOne({ where: { name: 'Special' } })
    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Brain (Resolution Lab)',
          regionId: regionSpecial.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', { name: 'Brain (Resolution Lab)' }, {})
  },
}
