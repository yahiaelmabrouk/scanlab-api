'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.renameColumn('Users', 'windowingStyle', 'vendorStylePreference'),
        queryInterface.addIndex('Users', ['userId'], {unique: true})
      ])
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.renameColumn('Users', 'vendorStylePreference', 'windowingStyle'),
        queryInterface.removeIndex('Users', ['userId'])
      ])
    })
  }
};
