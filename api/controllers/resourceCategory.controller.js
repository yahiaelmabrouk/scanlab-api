const express = require('express')
const router = express.Router()
const service = require('../services/resourceCategory.service')

router.get('/resourceCategories', async function (req, res) {
  let category = await service.getResourceCategoryById(req.query.id, req.query.languageCode)

  res.json({ success: true, data: category })
})

router.post('/resourceCategories', async function (req, res) {
  let resource = await service.addResourceCategory(req.body)

  res.json({ success: true, data: resource })
})

router.put('/resourceCategories/:id', async function (req, res) {
  let resourceCategory = await service.updateResourceCategory(req.params.id, req.body)

  res.json({ success: true, data: resourceCategory })
})

router.delete('/resourceCategories/:id', async function (req, res) {
  await service.deleteResourceCategory(req.params.id)

  res.json({ success: true })
})

module.exports = router
