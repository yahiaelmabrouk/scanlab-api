'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('QuestionMediaUploads', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      alt: {
        type: Sequelize.STRING
      },
      pathKey: {
        type: Sequelize.STRING
      },
      filename: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      multipleChoiceQuestionId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'MultipleChoiceQuestions',
          key: 'id'
        }
      }
    });

    return queryInterface.addIndex('QuestionMediaUploads', ['multipleChoiceQuestionId']);
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('QuestionMediaUploads');
  }
};