const express = require('express')
const router = express.Router()

const service = require('../services/weightBasedDose.service')

router.get('/weightBasedDose/all', async function (req, res) {
  let data = await service.getAllWeightBasedDoses()

  res.json({ success: true, data: data })
})

module.exports = router
