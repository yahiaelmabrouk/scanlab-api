const express = require('express')
const router = express.Router()
const service = require('../services/resource.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')
const { v4: uuidv4 } = require('uuid')
const { S3_BUCKET, createPresignedPost } = require('../api_util/aws')
const _ = require('lodash')

router.get('/resources/all', async function (req, res) {
  let resources = await service.getAllResources()

  res.json({ success: true, data: resources })
})

router.get('/resources/view', async function (req, res) {
  let resources = await service.getAllViewResources()

  res.json({ success: true, data: resources })
})

router.get('/resources', async function (req, res) {
  let language = await service.getResourceById(req.query.id)

  res.json({ success: true, data: language })
})

router.post('/resources/fileUpload', fetchLoggedInUser, requireAdmin, async function (req, res) {
  // To really support long filenames, it needs to be trimmed here (before the dot, if any...) for the path; the full filename is stored on the upload on completion regardless
  if (!_.isString(req.query.filename)) {
    res.status(200).json({ success: false, error: 'Invalid filename' })
  } else {
    const pathKey = `uploading/${uuidv4()}/${req.query.filename}`

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createPresignedPost-property
    const response = await createPresignedPost(pathKey, S3_BUCKET, req.query.type)

    // In the format for use with Vue2Dropzone:
    // https://rowanwins.github.io/vue-dropzone/docs/dist/#/aws-S3-upload
    res.json({
      postEndpoint: response.url,
      signature: response.fields,
    })
  }
})

router.post('/resources', async function (req, res) {
  let resource = await service.addResource(req.body)

  res.json({ success: true, data: resource })
})

router.put('/resources/reorder', async function (req, res) {
  const { categoryId, resourceIds } = req.body
  await service.reorderResources(categoryId, resourceIds)

  res.json({ success: true })
})

router.put('/resources/:id', async function (req, res) {
  let resources = await service.updateResource(req.params.id, req.body)

  res.json({ success: true, data: resources })
})

router.delete('/resources/:id', async function (req, res) {
  await service.deleteResource(req.params.id)

  res.json({ success: true })
})

module.exports = router
