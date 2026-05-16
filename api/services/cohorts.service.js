const _ = require('lodash')
const { DEFAULT_VENDOR_UIS } = require('../../util/constants/vendorUIs')
const apiUtil = require('../api_util/api_util')
const { Cohort, CohortStudent, CohortPreparedExam } = require('../../db/models')

const CohortsSvc = {
  findAllCohorts: async function (user, managedByMe, mine) {
    function addCohortIdsToQuery(cohortRoles) {
      return { id: cohortRoles.map((cohortRole) => cohortRole.cohortId) }
    }
    const query = {
      order: [['name', 'ASC']],
      attributes: [
        'id',
        'name',
        'area',
        'availableRegistrationCodesCount',
        'studentsCount',
        'settings',
        'adminSettings',
      ],
      include: [
        {
          model: CohortPreparedExam,
          as: 'cohortPreparedExams',
        },
      ],
    }

    if (managedByMe) {
      if (await apiUtil.isManagerOfCohort(user)) {
        query.where = addCohortIdsToQuery(await user.getCohortManagers())
      } else {
        throw new Error('Unauthorized: Must be a manager to access your own cohorts')
      }
    } else if (mine) {
      query.where = addCohortIdsToQuery(await user.getCohortStudents())
    } else if (!(await apiUtil.isAdmin(user))) {
      throw new Error('Unauthorized: Must be an admin to access ALL cohorts')
    }

    const cohorts = await Cohort.findAll(query)

    return Promise.all(
      _.map(cohorts, async function (cohort) {
        // Merge default vendorUIs into adminSettings
        if (!cohort.adminSettings) {
          cohort.adminSettings = {}
        }
        cohort.adminSettings.vendorUIs = _.defaultsDeep({}, cohort.adminSettings.vendorUIs || {}, DEFAULT_VENDOR_UIS)

        // When user is getting their own Cohort, augment it with that user-cohort's settingsFromManager
        if (mine) {
          let cohortStudent = await CohortStudent.findOne({
            where: { userId: user.id, cohortId: cohort.id },
          })
          return Object.assign({}, cohort.dataValues, {
            adminSettings: cohort.adminSettings,
            userSettingsFromManager: _.get(cohortStudent, 'settingsFromManager') || {},
          })
        } else {
          return cohort
        }
      })
    )
  },
}

module.exports = CohortsSvc
