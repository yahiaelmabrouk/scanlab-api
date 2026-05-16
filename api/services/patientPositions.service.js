const { PatientPosition, BodyBox, BodyPart, sequelize } = require('../../db/models')
const _ = require('lodash')
const logger = require('../../util/logger')
const bodyBoxesService = require('./bodyBoxes.service')

const getBaseBodyPartId = async (bodyPartId) => {
  let bodyPart = await BodyPart.findOne({
    order: [['name', 'DESC']],
    attributes: ['id', 'name', 'baseId'],
    where: {
      id: bodyPartId,
    },
  })

  if (!_.isNil(bodyPart.baseId)) {
    return bodyPart.baseId
  } else {
    return bodyPart.id
  }
}
const getPatientPositionsByModelId = async (modelId) => {
  const whereClauseBodyBox = modelId
    ? {
        modelId: modelId,
      }
    : {}

  let patientPositions = await PatientPosition.findAll({
    order: [['id', 'ASC']],
    attributes: ['id', 'value', 'isShowHeadHolder', 'positionSetId'],
    include: [
      {
        model: BodyBox,
        as: 'bodyBoxes',
        required: false,
        attributes: [
          'id',
          'x',
          'y',
          'z',
          'width',
          'length',
          'bodyBoxDirection',
          'mriUpDownPositionY',
          'landmarkTolerance',
          'landmarkToleranceBottom',
          'landmarkToleranceVertical',
          'height',
        ],
        where: whereClauseBodyBox,
      },
      {
        model: BodyPart,
        as: 'bodyPart',
        required: true,
        where: {
          baseId: null,
        },
      },
    ],
  })

  return patientPositions
}
const getPatientPositionsByBodyPartId = async (bodyPartId, modelId) => {
  const whereClause = bodyPartId
    ? {
        bodyPartId: bodyPartId,
      }
    : {}

  const whereClauseBodyBox = modelId
    ? {
        modelId: modelId,
      }
    : {}

  let patientPositions = await PatientPosition.findAll({
    order: [['id', 'ASC']],
    attributes: ['id', 'value', 'isShowHeadHolder', 'positionSetId'],
    include: [
      {
        model: BodyBox,
        as: 'bodyBoxes',
        required: false,
        attributes: [
          'id',
          'x',
          'y',
          'z',
          'width',
          'length',
          'bodyBoxDirection',
          'mriUpDownPositionY',
          'landmarkTolerance',
          'landmarkToleranceBottom',
          'landmarkToleranceVertical',
          'height',
        ],
        where: whereClauseBodyBox,
      },
    ],
    where: whereClause,
  })

  return patientPositions
}
const updateListPatientPosition = async (bodyPartId, { patientPositions }) => {
  const currentPatientPositions = await getPatientPositionsByBodyPartId(bodyPartId)
  await sequelize.transaction(async (transaction) => {
    if (_.size(patientPositions) > 0) {
      for (let patientPosition of patientPositions) {
        let { id, value, isShowHeadHolder, positionSetId } = patientPosition
        let foundPosition = _.find(currentPatientPositions, { id })
        if (!foundPosition) {
          let result = await PatientPosition.create(
            {
              value,
              bodyPartId,
              isShowHeadHolder,
              positionSetId,
            },
            { transaction }
          )
          patientPosition.id = result.id
          logger.info('Created patient positions', result.id)
        } else {
          _.extend(foundPosition, {
            value,
            isShowHeadHolder,
            positionSetId,
          })
          await foundPosition.save({ transaction })
        }
      }

      for (let patientPosition of currentPatientPositions) {
        // If none of the desired positions have the ID of this existing positions
        if (!_.some(patientPositions, { id: patientPosition.id })) {
          logger.info('Deleting patient positions', patientPosition.id)
          await patientPosition.destroy({ transaction })
        }
      }
    } else {
      // Delete all
      for (let patientPosition of currentPatientPositions) {
        await patientPosition.destroy({ transaction })
      }
    }
  })

  return patientPositions
}

const copyListPatientPosition = async (bodyPartId, modelId, { patientPositions }) => {
  const currentPatientPositions = await getPatientPositionsByBodyPartId(bodyPartId)
  await sequelize.transaction(async (transaction) => {
    if (_.size(patientPositions) > 0) {
      for (let patientPosition of patientPositions) {
        let { value, isShowHeadHolder, bodyBox, positionSetId } = patientPosition
        let foundPosition = _.find(currentPatientPositions, { isShowHeadHolder, value, positionSetId })
        if (!foundPosition) {
          let result = await PatientPosition.create(
            {
              value,
              bodyPartId,
              isShowHeadHolder,
            },
            { transaction }
          )
          patientPosition.id = result.id
          logger.info('Created patient positions', result.id)
        } else {
          _.extend(foundPosition, {
            value,
            isShowHeadHolder,
          })
          patientPosition.id = foundPosition.id
          await foundPosition.save({ transaction })
        }

        if (bodyBox) {
          await bodyBoxesService.copyBodyBox(bodyBox, modelId, patientPosition.id, bodyPartId, transaction)
        } else {
          await bodyBoxesService.deleteBodyBoxes(modelId, patientPosition.id, bodyPartId, transaction)
        }
      }

      for (let patientPosition of currentPatientPositions) {
        // If none of the desired positions have the ID of this existing positions
        if (!_.some(patientPositions, { id: patientPosition.id })) {
          logger.info('Deleting patient positions', patientPosition.id)
          await patientPosition.destroy({ transaction })
        }
      }
    } else {
      // Delete all
      for (let patientPosition of currentPatientPositions) {
        await patientPosition.destroy({ transaction })
      }
    }
  })

  return patientPositions
}

const PatientPositionsService = {
  getPatientPositionsByBodyPartId,
  updateListPatientPosition,
  copyListPatientPosition,
  getBaseBodyPartId,
  getPatientPositionsByModelId,
}

module.exports = PatientPositionsService
