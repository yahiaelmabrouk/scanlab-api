'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'StackQuestionResults',
      'sliceViews',
      {
        allowNull: true,
        type: Sequelize.JSONB
      }
    );
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'sliceViews', // key we want to remove
    )
  }
};
