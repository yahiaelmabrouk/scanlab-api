const express = require('express')
const router = express.Router()
const service = require('./services/regions.service')

router.get('/regions', async function (req, res) {
  return await service.findAllRegions(res)
})

router.get('/regions/testable', async function (req, res) {
  return await service.findTestableRegions(res)
})

module.exports = router
