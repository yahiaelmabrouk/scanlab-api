'use strict'

const _ = require('lodash')
const { TestRun, QuestionSet, Sequelize } = require('../db/models')
const Op = Sequelize.Op

// Give each TestRun a bodyPartId
// run this from root folder: node .\scripts\20220930170359-set-value-bodyPartId-to-TestRuns.js

async function doMigrate() {
  let testRuns = await TestRun.findAll({
    order: [['id', 'ASC']],
    attributes: ['id', 'questions', 'bodyPartId'],
    where: {
      id: { [Op.gt]: 0 },
      bodyPartId: { [Op.eq]: null },
      // timeStarted: {
      //   [Op.gte]: new Date(2022, 5, 1), // Jun 01 2022
      //   [Op.lt]: new Date(2022, 8, 12), // Sept 12 2022
      // }
    },
  })

  console.log('TestRuns to alter:', testRuns.length)

  let failedTestIds = []
  for (const testRun of testRuns) {
    console.log(`\nAltering TestRun ${testRun.id}`)
    try {
      const questionSetId = _.find(testRun.questions, { type: 'QUESTIONSET' }).id
      const questionSet = await QuestionSet.findByPk(questionSetId)

      if (!questionSet) {
        console.log(` QuestionSet ${questionSetId} does not exist`)
      } else {
        testRun.bodyPartId = questionSet.bodyPartId
        await testRun.save()
        console.log(`Done with TestRun ${testRun.id}: ${questionSet.bodyPartId}`)
      }
    } catch (e) {
      console.log('FAILED TO ALTER', testRun.id)
      console.log(e)
      failedTestIds.push(testRun.id)
    }
    console.log(`TALLY. Failed: ${failedTestIds.length}: \n${failedTestIds.join(',')}`)
  }

  console.log('All done!')
}
doMigrate()
