'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('Users', 'Users_email_key')
    await queryInterface.removeIndex('Users', 'Users_email_key')
    return queryInterface.sequelize.query(`create unique index "Users_email_key" on "Users" (lower(email))`)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('Users', 'Users_email_key')
    await queryInterface.removeIndex('Users', 'Users_email_key')
    return queryInterface.sequelize.query(`create unique index "Users_email_key" on "Users" (email)`)
  }
};
