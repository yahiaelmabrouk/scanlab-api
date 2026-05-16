'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('QuestionSets', 'isAvailable', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'QuestionSets', // name of Source model
      'isAvailable' // key we want to remove
    )
  },
}
