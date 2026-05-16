'use strict'

const { Region } = require('../models')

const BODYPART_NAMES = ['Pituitary (Resolution Lab)', 'IAC (Resolution Lab)']

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let regionSpecial = await Region.findOne({ where: { name: 'Special' } })
    for (let bodyPartName of BODYPART_NAMES) {
      await queryInterface.bulkInsert(
        'BodyParts',
        [
          {
            name: bodyPartName,
            regionId: regionSpecial.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        {}
      )
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (let bodyPartName of BODYPART_NAMES) {
      await queryInterface.bulkDelete('BodyParts', { name: bodyPartName }, {})
    }
  },
}
