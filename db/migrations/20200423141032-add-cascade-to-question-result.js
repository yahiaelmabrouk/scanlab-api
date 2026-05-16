'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('StackQuestionResults', null, {});
    await queryInterface.bulkDelete('QuestionSetResults', null, {});

    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'questionSetResultId', // key we want to remove
    )
    await queryInterface.addColumn(
      'StackQuestionResults',
      'questionSetResultId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSetResults', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      }
    )

    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'stackQuestionId', // key we want to remove
    )
    await queryInterface.addColumn(
      'StackQuestionResults',
      'stackQuestionId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'StackQuestions', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      }
    )

    await queryInterface.removeColumn(
      'QuestionSetResults', // name of Source model
      'questionSetId', // key we want to remove
    )
    await queryInterface.addColumn(
      'QuestionSetResults',
      'questionSetId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      }
    )

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('StackQuestionResults', null, {});
    await queryInterface.bulkDelete('QuestionSetResults', null, {});

    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'questionSetResultId', // key we want to remove
    )
    await queryInterface.addColumn(
      'StackQuestionResults',
      'questionSetResultId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSetResults', // name of Target model
          key: 'id', // key in Target model that we're referencing
        }
      }
    )

    await queryInterface.removeColumn(
      'StackQuestionResults', // name of Source model
      'stackQuestionId', // key we want to remove
    )
    await queryInterface.addColumn(
      'StackQuestionResults',
      'stackQuestionId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'StackQuestions', // name of Target model
          key: 'id', // key in Target model that we're referencing
        }
      }
    )

    await queryInterface.removeColumn(
      'QuestionSetResults', // name of Source model
      'questionSetId', // key we want to remove
    )
    await queryInterface.addColumn(
      'QuestionSetResults',
      'questionSetId', // name of the key we're adding 
      {
        type: Sequelize.INTEGER,
        references: {
          model: 'QuestionSets', // name of Target model
          key: 'id', // key in Target model that we're referencing
        }
      }
    )
  }
};