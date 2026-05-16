'use strict'
const { User, RegistrationCode, Cohort, CohortStudent } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const user = await User.create(
        {
          passHash: '$2a$10$D6K2i.1VF4m6O6wEMckQTu28VX7BgIpMC6SiMGRS/mg6HGYQE5Dzm', // password is password
          email: 'developer@scanlabmr.com',
          legalName: 'Dev Devson',
          nickName: 'Developer',
          vendorStylePreference: 'siemens',
          isAdmin: true,
        },
        { transaction }
      )

      const cohort = await Cohort.create(
        {
          name: 'Developers',
          availableRegistrationCodesCount: 0,
          studentsCount: 1,
        },
        { transaction }
      )

      const regCode = await RegistrationCode.create(
        {
          code: '9a978a3cdb044a4ca3d1',
          used: true,
          cohortId: cohort.id,
        },
        { transaction }
      )

      const cohortStudent = await CohortStudent.create(
        {
          cohortId: cohort.id,
          registrationCodeId: regCode.id,
          settingsFromManager: {},
          userId: user.id,
        },
        { transaction }
      )
    })
  },

  down: async (queryInterface, Sequelize) => {},
}
