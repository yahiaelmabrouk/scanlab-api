const express = require('express')
const router = express.Router()
const service = require('../services/patientPhysio.service')

router.get('/patientPhysio/random', async function (req, res) {
  let sets = await service.getRandomPatientPhysio()
  res.json({ success: true, data: sets })
})

router.get('/patientPhysio/all', async function (req, res) {
  let sets = await service.getAllPatientPhysios()
  res.json({ success: true, data: sets })
})

router.get('/patientPhysio', async function (req, res) {
  let sets = await service.getPatientPhysioById(req.query.id)
  res.json({ success: true, data: sets })
})

router.post('/patientPhysio', async function (req, res) {
  let set = await service.addPatientPhysio(req.body)
  res.json({ success: true, data: set })
})

router.put('/patientPhysio/:id', async function (req, res) {
  let set = await service.updatePatientPhysio(req.params.id, req.body)
  res.json({ success: true, data: set })
})

router.delete('/patientPhysio/:id', async function (req, res) {
  await service.deletePatientPhysio(req.params.id)
  res.json({ success: true })
})

module.exports = router
