'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('StackQuestions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      questionText: {
        type: Sequelize.TEXT
      },
      dicomInitialId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'DicomFileSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
      },
      dicomSubsequentId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'DicomFileSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
      },
      answers: {
        type: Sequelize.JSON
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('StackQuestions');
  }
};