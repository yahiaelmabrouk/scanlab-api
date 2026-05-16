const { BodyBox, sequelize } = require('../../db/models')
const _ = require('lodash')
const logger = require('../../util/logger')
// const getBodyBoxesByBodyPartAndPatientPosition = async (bodyPartId, patientPositionId) => {
//   const whereClause = {
//     bodyPartId: bodyPartId,
//     patientPositionId: patientPositionId,
//   }

//   let bodyBoxes = await BodyBox.findAll({
//     order: [['id', 'ASC']],
//     where: whereClause,
//   })

//   return bodyBoxes
// }
const getBodyBoxesByBodyPartByFilter = async (bodyPartId, patientPositionId, modelId) => {
  const whereClause = {
    bodyPartId,
    patientPositionId,
    modelId,
  }

  Object.keys(whereClause).forEach((key) => whereClause[key] === undefined && delete whereClause[key])

  let bodyBoxes = await BodyBox.findAll({
    order: [['id', 'ASC']],
    where: whereClause,
  })

  return bodyBoxes
}

const deleteBodyBoxes = async (modelId, patientPositionId, bodyPartId, transaction) => {
  const currentBodyBoxes = await getBodyBoxesByBodyPartByFilter(bodyPartId, patientPositionId, modelId)

  for (let currentBodyBox of currentBodyBoxes) {
    await currentBodyBox.destroy({ transaction })
  }

  return null
}

const copyBodyBox = async (bodyBox, modelId, patientPositionId, bodyPartId, transaction) => {
  const currentBodyBoxes = await getBodyBoxesByBodyPartByFilter(bodyPartId, patientPositionId, modelId)
  let foundBodyBox = bodyBox ? _.find(currentBodyBoxes, { id: bodyBox.id }) : null
  if (bodyBox) {
    let {
      x,
      y,
      z,
      width,
      length,
      bodyBoxDirection,
      mriUpDownPositionY,
      landmarkTolerance,
      landmarkToleranceBottom,
      landmarkToleranceVertical,
      height,
    } = bodyBox
    if (!foundBodyBox) {
      let result = await BodyBox.create(
        {
          bodyPartId,
          patientPositionId,
          x,
          y,
          z,
          width,
          length,
          bodyBoxDirection,
          mriUpDownPositionY,
          landmarkTolerance,
          landmarkToleranceBottom,
          landmarkToleranceVertical,
          modelId,
          height,
        },
        { transaction }
      )
      bodyBox.id = result.id
      logger.info('Created body box', result.id)
    } else {
      _.extend(foundBodyBox, {
        x,
        y,
        z,
        width,
        length,
        bodyBoxDirection,
        mriUpDownPositionY,
        landmarkTolerance,
        landmarkToleranceBottom,
        landmarkToleranceVertical,
        modelId,
        height,
      })
      await foundBodyBox.save({ transaction })
    }

    for (let currentBodyBox of currentBodyBoxes) {
      if (!(currentBodyBox.id == bodyBox.id)) {
        await currentBodyBox.destroy({ transaction })
      }
    }
  } else {
    for (let currentBodyBox of currentBodyBoxes) {
      await currentBodyBox.destroy({ transaction })
    }
  }

  return null
}

const updateMultiBodyBoxes = async (newBodyBoxes, modelId) => {
  await sequelize.transaction(async (transaction) => {
    if (_.size(newBodyBoxes) > 0) {
      for (let newBodyBox of newBodyBoxes) {
        let { bodyPartId, patientPositionId, bodyBox } = newBodyBox
        const currentBodyBoxes = await getBodyBoxesByBodyPartByFilter(bodyPartId, patientPositionId, modelId)
        let foundBodyBox = bodyBox ? _.find(currentBodyBoxes, { id: bodyBox.id }) : null
        if (bodyBox) {
          let {
            x,
            y,
            z,
            width,
            length,
            bodyBoxDirection,
            mriUpDownPositionY,
            landmarkTolerance,
            landmarkToleranceBottom,
            landmarkToleranceVertical,
            modelId,
            height,
          } = bodyBox
          if (!foundBodyBox) {
            let result = await BodyBox.create(
              {
                bodyPartId,
                patientPositionId,
                x,
                y,
                z,
                width,
                length,
                bodyBoxDirection,
                mriUpDownPositionY,
                landmarkTolerance,
                landmarkToleranceBottom,
                landmarkToleranceVertical,
                modelId,
                height,
              },
              { transaction }
            )
            logger.info('Created body box', result.id)
          } else {
            _.extend(foundBodyBox, {
              x,
              y,
              z,
              width,
              length,
              bodyBoxDirection,
              mriUpDownPositionY,
              landmarkTolerance,
              landmarkToleranceBottom,
              landmarkToleranceVertical,
              modelId,
              height,
            })
            await foundBodyBox.save({ transaction })
          }

          for (let currentBodyBox of currentBodyBoxes) {
            if (!(currentBodyBox.id == bodyBox.id)) {
              await currentBodyBox.destroy({ transaction })
            }
          }
        } else {
          for (let currentBodyBox of currentBodyBoxes) {
            await currentBodyBox.destroy({ transaction })
          }
        }
      }
    }
  })

  return null
}

const bodyBoxesService = {
  updateMultiBodyBoxes,
  copyBodyBox,
  deleteBodyBoxes,
}

module.exports = bodyBoxesService
