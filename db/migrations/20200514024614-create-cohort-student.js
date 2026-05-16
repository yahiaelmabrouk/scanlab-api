'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CohortStudents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      cohortId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'Cohorts',
          key: 'id'
        }
      },
      registrationCodeId: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: {
          model: 'RegistrationCodes',
          key: 'id'
        }
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
    return queryInterface.dropTable('CohortStudents');
  }
};
