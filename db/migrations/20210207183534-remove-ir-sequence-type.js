'use strict';

const { StackQuestion, TestRun } = require('../models');
const testSvc = require('../../api/services/testRun.service')

module.exports = {
  // IR is no longer a valid sequence type. The equivalent is SE + inversionRecovery being enabled
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async transaction => {

      let stackQuestions = await StackQuestion.findAll({ transaction });

      // Fix the correct answers
      for (const question of stackQuestions) {
        const answers = question.answers
        if(answers && answers.length > 0 && answers.some((a) => (a['0_min'] && a['0_min'].sequenceType === 'IR') || (a['0_max'] && a['0_max'].sequenceType === 'IR'))){
          console.log("\nOriginal StackQuestion\n", JSON.stringify(question))
          question.answers = answers.map( a => {
            // contrast lab use single groups for now
            if(a['0_min'] && a['0_min'].sequenceType === 'IR'){
              a['0_min'].sequenceType = 'SE'
              a['0_min'].inversionRecovery = true
            }
            if(a['0_max'] && a['0_max'].sequenceType === 'IR'){
              a['0_max'].sequenceType = 'SE'
              a['0_max'].inversionRecovery = true
            }

            // no need to touch the proposed group

            return a
          })

          await question.save({ transaction })

          console.log("\nModified StackQuestion\n", JSON.stringify(question))
        }
          
      }

      let testRuns = await TestRun.findAll({ transaction });
        
      // Fix all test runs
      for (const testRun of testRuns) {
        const answers = testRun.answers
        const hasIR = answers.some((a) => a.variables && a.variables.some(v => v && v.sequenceType === 'IR'))

        if(answers && answers.length > 0 && hasIR){
          console.log(`\nOriginal TestRun (${testRun.score}%)\n`, JSON.stringify(testRun))

          testRun.answers = answers.map( a => {
            if(a.variables && a.variables.length > 0) {
              a.variables = a.variables.map(v => {
                if(v && v.sequenceType === 'IR') {
                  v.sequenceType = 'SE'
                  v.inversionRecovery = true
                }
                return v
              })
            }

            return a
          })

          await testRun.save({ transaction })

          await testSvc.regrade(testRun.id, transaction)

          console.log(`\nModified TestRun (${testRun.score}%)\n`, JSON.stringify(testRun))
        }
          
      }
    });
  },

  down: async (queryInterface, Sequelize) => {

  }
};
