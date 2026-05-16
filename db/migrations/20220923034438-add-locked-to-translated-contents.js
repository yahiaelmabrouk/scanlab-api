'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn('TranslatedContents', 'locked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('TranslatedContents', 'locked')
  },
}
