'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn(
          'StackQuestions', // name of Source model
          'dicomInitialId', // key we want to remove
          { transaction }
        ),
        queryInterface.removeColumn(
          'StackQuestions', // name of Source model
          'dicomSubsequentId', // key we want to remove
          { transaction }
        )
      ])
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn(
          'StackQuestions', // name of Source model
          'dicomInitialId', // name of the key we're adding
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: 'DicomFileSets', // name of Target model
              key: 'id', // key in Target model that we're referencing
            }
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'StackQuestions', // name of Source model
          'dicomSubsequentId', // name of the key we're adding
          {
            type: Sequelize.INTEGER,
            references: {
              model: 'DicomFileSets', // name of Target model
              key: 'id', // key in Target model that we're referencing
            }
          },
          { transaction }
        )
      ])
    })
  }
};
