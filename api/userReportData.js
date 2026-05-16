const express = require('express')
const moment = require('moment/moment')
const router = express.Router()
const logger = require('../util/logger')
const { fetchLoggedInUser } = require('./api_util/api_util')
const { S3_BUCKET, getSignedUrl } = require('./api_util/aws')

// for uploading the user's state during a user report
router.post('/userReportData', fetchLoggedInUser, async function (req, res) {
  let userId = req.session.user.id
  const envPath = process.env.NODE_ENV ?? 'development'
  const dateStr = moment().format('yyyy/MM/DD')
  const pathKey = `user-reports/${envPath}/${dateStr}/${Date.now()}_${userId}.json`
  logger.info('Uploading userReportData to presigned key: ' + pathKey)

  const presignedS3Url = await getSignedUrl('putObject', pathKey, S3_BUCKET, 'application/json')

  res.json({
    pathKey,
    presignedS3Url,
  })
})

module.exports = router
