'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'PreparedExams',
      'isSkill',
      {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: true
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'PreparedExams', // name of Source model
      'isSkill', // key we want to remove
    )
  }
};
