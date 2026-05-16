'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'preferredAnswerCriteriaByStackQuestionId', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'preferredAnswerCriteriaByStackQuestionId')
  },
}
