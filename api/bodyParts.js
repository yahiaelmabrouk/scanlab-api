const express = require('express')
const router = express.Router()
const { BodyPart, Region, QuestionSet, DicomFileSet, sequelize } = require('../db/models')
const _ = require('lodash')

router.get('/bodyParts', async function (req, res) {
  const whereClause = req.query.regionId
    ? {
        regionId: req.query.regionId,
      }
    : {}

  let bodyParts = await BodyPart.findAll({
    order: [['name', 'DESC']],
    attributes: ['id', 'name', 'withOut', 'withOnly', 'withOutWith', 'baseId', 'contrastTypes'],
    include: [
      {
        model: Region,
        as: 'region',
        attributes: ['id', 'name'],
      },
    ],
    where: whereClause,
  })

  res.json({ success: true, bodyParts })
})

router.get('/bodyParts/testable', async function (req, res) {
  let bodyParts = await BodyPart.findAll({
    order: [['name', 'DESC']],
    attributes: ['id', 'name', 'withOut', 'withOnly', 'withOutWith', 'baseId', 'contrastTypes'],
    include: [
      {
        model: BodyPart,
        required: false,
        as: 'base',
        attributes: ['id', 'name', 'withOut', 'withOnly', 'withOutWith', 'baseId', 'contrastTypes'],
      },
      {
        model: Region,
        required: true,
        as: 'region',
        attributes: ['id', 'name', 'anatomicalOrder'],
      },
      {
        model: QuestionSet,
        required: true,
        as: 'questionSets',
        attributes: ['id'],
        where: {
          isAvailable: true,
        },
        include: [
          {
            model: DicomFileSet,
            required: true,
            as: 'DicomFileSet',
            attributes: ['type'],
          },
        ],
      },
    ],
  })

  res.json({ success: true, bodyParts })
})

router.get('/bodyParts/updateData', async function (req, res) {
  let bodyParts = await BodyPart.findAll({})

  await sequelize.transaction(async (transaction) => {
    if (_.size(bodyParts) > 0) {
      for (let bodyPart of bodyParts) {
        _.extend(bodyPart, {
          contrastTypes: {
            withOnly: _.get(bodyPart, ['withOnly'], false),
            withOut: _.get(bodyPart, ['withOut'], false),
            withOutWith: _.get(bodyPart, ['withOutWith'], false),
            threePhase: _.get(bodyPart, ['threePhase'], false),
          },
        })
        await bodyPart.save({ transaction })
      }
    }
  })

  res.json({ success: true, bodyParts })
})

router.get('/bodyParts/:id', async function (req, res) {
  let bodyParts = await BodyPart.findOne({
    order: [['name', 'DESC']],
    attributes: ['id', 'name'],
    include: [
      {
        model: Region,
        as: 'region',
        attributes: {
          exclude: ['id', 'name'],
        },
      },
    ],
    where: {
      id: req.params.id,
    },
  })

  res.json({ success: true, bodyParts })
})

module.exports = router
