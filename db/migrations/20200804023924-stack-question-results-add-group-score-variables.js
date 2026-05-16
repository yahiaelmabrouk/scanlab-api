'use strict';
const { StackQuestionResult } = require('../models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('StackQuestionResults', 'groupScoreVariables', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    })

    await queryInterface.removeColumn(
      'StackQuestionResults',
      'scoreVariables'
    )
  },

  down: async (queryInterface, Sequelize) => {
    // not 100% historically accurate, but fine :P
    await queryInterface.addColumn('StackQuestionResults', 'scoreVariables', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    })

    await queryInterface.removeColumn(
      'StackQuestionResults',
      'groupScoreVariables'
    )
  }
};
