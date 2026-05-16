'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Categories',
      [
        {
          id: 14,
          name: 'Encoding',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, ) => {
    await queryInterface.bulkDelete('Categories', { name: 'Encoding' }, {})
  },
}
