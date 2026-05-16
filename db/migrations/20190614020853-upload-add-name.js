'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    // http://docs.sequelizejs.com/class/lib/query-interface.js~QueryInterface.html#instance-method-addColumn
    return queryInterface.addColumn(
      'Uploads', // name of Source model
      'filename', // name of the key we're adding
      {
        type: Sequelize.TEXT,
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Uploads', // name of Source model
      'filename' // key we want to remove
    );
  }
};
