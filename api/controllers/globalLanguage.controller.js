const express = require('express')
const router = express.Router()
const service = require('../services/language.service')
const resourceCategoryService = require('../services/resourceCategory.service')

router.get('/health', async function (req, res) {
  res.json({ success: true, data: 'OK' })
})
router.get('/languages/all', async function (req, res) {
  let languages = await service.getAllLanguages()

  res.json({ success: true, data: languages })
})

router.get('/languages/options', async function (req, res) {
  let languages = await service.getAllLanguageOptions()

  res.json({ success: true, data: languages })
})

router.get('/resourceCategories/all', async function (req, res) {
  let categories = await resourceCategoryService.getAllResourceCategories()

  res.json({ success: true, data: categories })
})

router.get('/languages', async function (req, res) {
  let language = await service.getLanguageByCode(req.query.code)

  res.json({ success: true, data: language })
})

module.exports = router
