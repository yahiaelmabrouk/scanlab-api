'use strict';

const { Cohort } = require('../models');
const { updateCounts } = require('../../api/api_util/cohorts');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let cohorts = await Cohort.findAll();

    for(let i = 0; i < cohorts.length; i++) {
      let cohort = cohorts[i];
      await updateCounts(cohort);
    }
  },

  down: (queryInterface, Sequelize) => {
    // nothing to do
    return Promise.resolve(true);
  }
};
