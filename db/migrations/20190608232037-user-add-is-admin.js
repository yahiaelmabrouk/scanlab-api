'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    // http://docs.sequelizejs.com/class/lib/query-interface.js~QueryInterface.html#instance-method-addColumn
    return queryInterface.addColumn(
      'Users', // name of Source model
      'isAdmin', // name of the key we're adding
      {
        type: Sequelize.BOOLEAN,
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Users', // name of Source model
      'isAdmin' // key we want to remove
    );
  }
};
