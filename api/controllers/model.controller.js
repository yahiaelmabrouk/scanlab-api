const express = require('express')
const router = express.Router()
const service = require('../services/model.service')

router.get('/model', async function (req, res) {
  let models = await service.getModels()

  res.json({ success: true, data: models })
})

router.put('/model/:id', async function (req, res) {
  let models = await service.updateModel(req.params.id, req.body)

  res.json({ success: true, data: models })
})

module.exports = router
