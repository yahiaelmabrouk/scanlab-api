'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('StackQuestionResults', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      score: {
        type: Sequelize.DECIMAL(5, 2)
      },
      answer: {
        type: Sequelize.STRING
      },
      attemptedAnswerIdentifier: {
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
      stackQuestionId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'StackQuestions',
          key: 'id',
        }
      },
      questionSetResultId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSetResults',
          key: 'id',
        }
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('StackQuestionResults');
  }
};