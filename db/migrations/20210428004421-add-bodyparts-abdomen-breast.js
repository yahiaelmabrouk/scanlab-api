'use strict'

const { Region } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let regionAbdomen = await Region.findOne({ where: { name: 'Abdomen' } })
    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Abdomen',
          regionId: regionAbdomen.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )

    let regionThorax = await Region.findOne({ where: { name: 'Thorax' } })
    await queryInterface.bulkInsert(
      'BodyParts',
      [
        {
          name: 'Breast',
          regionId: regionThorax.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('BodyParts', { name: 'Breast' }, {})
    await queryInterface.bulkDelete('BodyParts', { name: 'Abdomen' }, {})
  },
}
