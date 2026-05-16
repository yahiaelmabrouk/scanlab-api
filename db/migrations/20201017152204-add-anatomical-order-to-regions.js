'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Regions', 'anatomicalOrder', {
      type: Sequelize.INTEGER,
      unique: true
    })

    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 1 WHERE id = 1') // Head
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 2 WHERE id = 9') // Head (Contrast Lab)
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 3 WHERE id = 10') // Angiography
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 4 WHERE id = 2') // Neck
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 5 WHERE id = 3') // Spine
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 6 WHERE id = 4') // Upper Extremities
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 7 WHERE id = 5') // Thorax
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 8 WHERE id = 6') // Abdomen
    await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 9 WHERE id = 7') // Pelvis
    return await queryInterface.sequelize.query('UPDATE "Regions" SET "anatomicalOrder" = 10 WHERE id = 8') // Lower Extremities
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.removeColumn('Regions', 'anatomicalOrder')
  },
}
