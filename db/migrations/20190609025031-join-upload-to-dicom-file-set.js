'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    // https://medium.com/@andrewoons/how-to-define-sequelize-associations-using-migrations-de4333bf75a7
    // belongsToMany
    return queryInterface.createTable(
      'JoinUploadToDicomFileSet',
      {
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        uploadId: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          references: {
            model: 'Uploads', // name of Target model
            key: 'id', // key in Target model that we're referencing
          },
        },
        dicomFileSetId: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          references: {
            model: 'DicomFileSets', // name of Target model
            key: 'id', // key in Target model that we're referencing
          },
        },
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    // remove table
    return queryInterface.dropTable('JoinUploadToDicomFileSet');
  }
};
