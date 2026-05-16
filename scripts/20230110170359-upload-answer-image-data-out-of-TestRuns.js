'use strict'

const _ = require('lodash')
const { TestRun, QuestionSetResult, Sequelize, StackQuestionResult } = require('../db/models')
const Op = Sequelize.Op
const testSvc = require('../api/services/testRun.service')

// Upload the Image Scans out of the answers data for TestRuns
// run this from root folder: node .\scripts\20230110170359-upload-answer-image-data-out-of-TestRuns.js
// This script requires uploading to S3, so your aws credentials should be provided as ENV vars (or edit aws.js)
//  Also set Env to production so it uploads to the correct folder

async function doMigrate() {
  let testRuns = await TestRun.findAll({
    order: [['id', 'ASC']],
    attributes: ['id'],
    where: {
      id: { [Op.gt]: 0, [Op.lt]: 98765 }, // id 98765 is when I shipped the fix to no longer put the full image data into TestRuns
      // bodyPartId: { [Op.eq]: null },
      // updatedAt: {
      //   [Op.lt]: new Date(2022, 0, 12), // Jan 12 2023
      // }
      // timeStarted: {
      //   [Op.gte]: new Date(2022, 5, 1), // Jun 01 2022
      //   [Op.lt]: new Date(2022, 8, 12), // Sept 12 2022
      // }
    },
  })

  console.log('TestRuns to process:', testRuns.length)

  let failedTestIds = []
  for (let testRun of testRuns) {
    console.log(`\nTestRun ${testRun.id} - Uploading test scans as needed`)
    try {
      testRun = await TestRun.findOne({
        where: { id: testRun.id },
        attributes: ['id', 'answers'],
      })
      for (let answer of testRun.answers) {
        answer = await testSvc.uploadAnswerImages(testRun, answer)
      }
      // We've manipulated the testRun.answers above, and we need Sequelize to realize there was a change to persist to the db
      testRun.answers = _.clone(testRun.answers)
      await testRun.save()

      // also remove base64 from stackQuestionResult.sliceViews; which are associated via questionSetResults (but some testRuns don't have these)
      // TODO: While this gets all the QuestionSetResults that have a TestRun, there are also QSRs that do not have a testRunId. Their associated StackQuestionResults will not have their sliceViews uploaded to S3 by this
      //   There are only about 2,200 of these in prod (vs ~102,000 testRuns), so not as high a priority
      let questionSetResult = await QuestionSetResult.findOne({ where: { testRunId: testRun.id }, attributes: ['id'] })

      if (questionSetResult) {
        let stackQuestionResults = await StackQuestionResult.findAll({
          where: { questionSetResultId: questionSetResult.id },
          attributes: ['id', 'stackQuestionId', 'sliceViews'],
        })

        // There should be one StackQuestionResult for every Question answered/skipped
        for (let stackQuestionResult of stackQuestionResults) {
          let answer = _.find(testRun.answers, { stackQuestionId: stackQuestionResult.stackQuestionId })
          if (!answer?.sliceViews) {
            console.log(
              'Error: TESTRUN ',
              testRun.id,
              ' has a related stackQuestionResult',
              stackQuestionResult.id,
              ' but no matching answer for it',
              stackQuestionResult.stackQuestionId
            )
          } else {
            // copy the ones from the testRun, since this is the same data
            stackQuestionResult.sliceViews = answer.sliceViews
            await stackQuestionResult.save()
          }
        }
      }

      console.log(` Done with TestRun ${testRun.id}`)
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
