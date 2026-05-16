'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'StackQuestions',
      'alterVolumeView',
      {
        type: Sequelize.BOOLEAN
      })
    return queryInterface.addColumn(
      'StackQuestions',
      'alterSpacingThickness',
      {
        type: Sequelize.BOOLEAN
      })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'alterVolumeView', // key we want to remove
    )
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'alterSpacingThickness', // key we want to remove
    )
  }
};
