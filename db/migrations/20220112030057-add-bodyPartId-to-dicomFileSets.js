'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('DicomFileSets', 'bodyPartId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'BodyParts', // name of Target model
        key: 'id', // key in Target model that we're referencing
      },
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('DicomFileSets', 'bodyPartId')
  },
}
