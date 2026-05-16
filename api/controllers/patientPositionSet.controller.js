const express = require('express')
const router = express.Router()
const service = require('../services/patientPositionSet.service')

router.get('/patientPositionSet', async function (req, res) {
  let sets = await service.getPatientPositionSets(req.query.bodyPartId)
  res.json({ success: true, data: sets })
})

router.post('/patientPositionSet', async function (req, res) {
  let set = await service.addPatientPositionSet(req.body)
  res.json({ success: true, data: set })
})

router.put('/patientPositionSet/:id', async function (req, res) {
  let set = await service.updatePatientPositionSet(req.params.id, req.body)
  res.json({ success: true, data: set })
})

router.delete('/patientPositionSet/:id', async function (req, res) {
  await service.deletePatientPositionSet(req.params.id)
  res.json({ success: true })
})

router.get('/initPatientPositionSet', async function (req, res) {
  let sets = await service.initPatientPositionSet()
  res.json({ success: true, data: sets })
})

module.exports = router
