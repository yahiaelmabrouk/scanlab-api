'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addIndex('TranslatedContents', ['key'], {unique: true})
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('TranslatedContents', ['key'])
  }
};
