'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'StackQuestions',
      'ignoreInPlaneRotation',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      })

  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'StackQuestions', // name of Source model
      'ignoreInPlaneRotation', // key we want to remove
    )
  }
};