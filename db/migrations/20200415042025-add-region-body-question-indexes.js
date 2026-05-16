'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('BodyParts', ['regionId'])
    return queryInterface.addIndex('QuestionSets', ['bodyPartId'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('BodyParts', ['regionId'])
    return queryInterface.removeIndex('QuestionSets', ['bodyPartId'])
  }
};