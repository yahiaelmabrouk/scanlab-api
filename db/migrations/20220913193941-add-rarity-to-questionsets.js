'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('QuestionSets', 'rarity', {
      type: Sequelize.STRING,
      defaultValue: 'common',
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('QuestionSets', 'rarity')
  }
};
