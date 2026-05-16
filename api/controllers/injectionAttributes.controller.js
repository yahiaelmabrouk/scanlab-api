const express = require('express')
const router = express.Router()
const service = require('../services/injectionAttributes.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')

router.get('/injection/injectionAttributes', async function (req, res) {
  try {
    let result = await service.getInjectionAttributesByBodyPartId(req.query.bodyPartId)
    res.json({ success: true, result })
  } catch (error) {
    res.status(error.status).json(error.message)
  }
})

router.patch('/injection/injectionAttributes', async function (req, res) {
  const data = req.body
  const { bodyPartId } = req.query

  try {
    let result = await service.updateInjectionAttribute(bodyPartId, data)
    res.json({ success: true, result })
  } catch (error) {
    res.status(error.status).json(error.message)
  }
})

module.exports = router
