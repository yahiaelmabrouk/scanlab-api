'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`UPDATE "BodyParts" SET name='Bony Pelvis' WHERE name='Boney Pelvis'`);
  },

  down: async (queryInterface, Sequelize) => {
    
  }
};
