'use strict';

const { CohortStudent, RegistrationCode } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Backfill all used registrationCode without activationDate to the cohortStudent.createdAt

    let cohortStudents = await CohortStudent.findAll({
      where: {},
      include: [
        {
          model: RegistrationCode,
          as: 'registrationCode',
          // attributes: ['registrationCodeId', 'userId'],
          where: {
            used: true,
            activationDate: null
          }
        },
      ],
    })
    console.log('registrationCode without activationDate', cohortStudents.length)
    for (const cohortStudent of cohortStudents) {
      let {registrationCode} = cohortStudent
      console.log('registrationCode.activationDate', registrationCode.id, registrationCode.activationDate, cohortStudent.createdAt)
      registrationCode.activationDate = cohortStudent.createdAt
      await registrationCode.save()
    }
  },

  down: async (queryInterface, Sequelize) => {
  }
};
