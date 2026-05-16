'use strict'

const express = require('express')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      'Categories',
      [
        {
          id: 12,
          name: 'Contrast Bolus',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    )
  },

  down: async (queryInterface, ) => {
    await queryInterface.bulkDelete('Categories', { name: 'Contrast Bolus' }, {})
  },
}
