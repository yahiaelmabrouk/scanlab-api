'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Categories',
      [
        {
          id: 13,
          name: 'Demo Questions',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, ) => {
    await queryInterface.bulkDelete('Categories', { name: 'Demo Questions' }, {})
  },
}
