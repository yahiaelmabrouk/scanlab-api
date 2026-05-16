const express = require('express')
const router = express.Router()
const service = require('../services/patientPositions.service')
const modelService = require('../services/model.service')
const _ = require('lodash')
const { fetchLoggedInUser, requireAdmin } = require('../api_util/api_util')

router.get('/patientPositions/getPatinetPositionsHaveBodyBoxes', async function (req, res) {
  let models = await modelService.getModels(req.query.exceptModelId, req.query.gender, req.query.age)
  let model = null
  let patientPositions = []

  let bodyPartId = req.query.bodyPartId
  bodyPartId = await service.getBaseBodyPartId(bodyPartId)

  let availablePositionsByModel = []
  for (let i = 0; i < models.length; i++) {
    let datas = await service.getPatientPositionsByBodyPartId(bodyPartId, models[i].id)
    if (datas.length > 0) {
      const group = _.groupBy(datas, 'positionSetId')

      const keys = Object.keys(group)

      if (
        _.get(datas, ['length'], 0) > 0 &&
        !_.some(keys, (key) => !_.some(group[key], (el) => _.get(el, ['bodyBoxes', 'length'], 0) > 0))
      ) {
        availablePositionsByModel.push({
          patientPositions: datas,
          model: models[i],
        })
      }
    }
  }

  //random pick an available model
  if (availablePositionsByModel.length > 0) {
    const randomByModel = availablePositionsByModel[Math.floor(Math.random() * availablePositionsByModel.length)]
    model = randomByModel.model
    patientPositions = randomByModel.patientPositions
  } else if (models.length > 0) {
    //if no available model, pick the first model without body boxes to init patient info in client side
    model = models[0]
  } else {
    let existModels = await modelService.getModels(null, req.query.gender, null)
    if (existModels.length > 0) {
      model = existModels[0]
    }
  }

  res.json({ success: true, patientPositions, model })
})

router.get('/patientPositions/getAllByModelId', async function (req, res) {
  let patientPositions = await service.getPatientPositionsByModelId(req.query.modelId)

  res.json({ success: true, patientPositions })
})

router.get('/patientPositions', async function (req, res) {
  let bodyPartId = req.query.bodyPartId
  bodyPartId = await service.getBaseBodyPartId(bodyPartId)

  let patientPositions = await service.getPatientPositionsByBodyPartId(bodyPartId, req.query.modelId)

  res.json({ success: true, patientPositions })
})

router
  .route('/patientPositions/updateByBodyPart/:bodyPartId')
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    let patientPositions = await service.updateListPatientPosition(req.params.bodyPartId, req.body)

    res.json({ success: true, patientPositions })
  })
router
  .route('/patientPositions/copyByMultiBodyParts/:modelId')
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    const data = req.body.data
    for (let i = 0; i < data.length; i++) {
      await service.copyListPatientPosition(data[i].bodyPartId, req.params.modelId, {
        patientPositions: data[i].patientPositions,
      })
    }
    res.json({ success: true })
  })
router
  .route('/patientPositions/copyByBodyPart/:bodyPartId/:modelId')
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    await service.copyListPatientPosition(req.params.bodyPartId, req.params.modelId, req.body)

    let patientPositions = await service.getPatientPositionsByBodyPartId(req.params.bodyPartId, req.params.modelId)
    res.json({ success: true, patientPositions })
  })

module.exports = router
