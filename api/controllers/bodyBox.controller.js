const express = require('express')
const router = express.Router()
const service = require('../services/bodyBoxes.service')
const patientPositionService = require('../services/patientPositions.service')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')

router
  .route('/bodyBoxes/updateMultiBodyBoxes/:bodyPartId/:modelId')
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    await service.updateMultiBodyBoxes(req.body.newBodyBoxes, req.params.modelId)
    let patientPositions = await patientPositionService.getPatientPositionsByBodyPartId(
      req.params.bodyPartId,
      req.params.modelId
    )
    res.json({ success: true, patientPositions })
  })

module.exports = router
