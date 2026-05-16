'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(transaction => {
      return Promise.all([
        queryInterface.addColumn(
          'Cohorts', // name of Source model
          'availableRegistrationCodesCount', // name of the key we're adding
          {
            allowNull: false,
            defaultValue: 0,
            type: Sequelize.INTEGER
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'Cohorts', // name of Source model
          'studentsCount', // name of the key we're adding
          {
            allowNull: false,
            defaultValue: 0,
            type: Sequelize.INTEGER
          },
          { transaction }
        )
      ])
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(transaction => {
      return Promise.all([
        queryInterface.removeColumn(
          'Cohorts', // name of Source model
          'availableRegistrationCodesCount', // key we want to remove
          { transaction }
        ),
        queryInterface.removeColumn(
          'Cohorts', // name of Source model
          'studentsCount', // key we want to remove
          { transaction }
        )
      ]);
    });
  }
};
