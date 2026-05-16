'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addConstraint('QuestionSets', ['dicomFileSet'], {
      type: 'FOREIGN KEY',
      name: 'QuestionSets_dicomFileSet_fkey',
      references: {
        table: 'DicomFileSets',
        field: 'id',
      },
      onDelete: 'no action',
      onUpdate: 'no action',
    })
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeConstraint('QuestionSets', 'QuestionSets_dicomFileSet_fkey')
  }
};