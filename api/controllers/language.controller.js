const express = require('express')
const router = express.Router()
const service = require('../services/language.service')

router.post('/languages', async function (req, res) {
  let language = await service.addLanguage(req.body)

  res.json({ success: true, data: language })
})

router.put('/languages/:id', async function (req, res) {
  let languages = await service.updateLanguage(req.params.id, req.body)

  res.json({ success: true, data: languages })
})

module.exports = router
