const { PatientPositionSet, PatientPosition, BodyPart, sequelize } = require('../../db/models')
const _ = require('lodash')

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

const getPatientPositionSets = async (bodyPartId) => {
  let partId = await getBaseBodyPartId(bodyPartId)
  let where = {
    bodyPartId: partId,
  }

  let sets = await PatientPositionSet.findAll({
    where,
    order: [['id', 'ASC']],
    attributes: ['id', 'name'],
  })

  return sets
}

const updatePatientPositionSet = async (id, data) => {
  const set = await PatientPositionSet.findOne({
    where: { id },
  })

  if (!set) {
    throw { status: 400, message: 'PatientPositionSet not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      _.extend(set, {
        ...data,
      })

      await set.save({ transaction })
      result = set
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const addPatientPositionSet = async (data) => {
  let { name, bodyPartId } = data
  let result = await PatientPositionSet.create({
    name,
    bodyPartId,
  })

  return result
}

const deletePatientPositionSet = async (id) => {
  const set = await PatientPositionSet.findOne({
    where: { id },
  })

  if (!set) {
    throw { status: 400, message: 'PatientPositionSet not found' }
  }

  set.destroy()

  return null
}

const initPatientPositionSet = async () => {
  const patientPositions = await PatientPosition.findAll()
  const group = _.groupBy(patientPositions, 'bodyPartId')

  await sequelize.transaction(async (transaction) => {
    const keys = Object.keys(group)

    for (let key of keys) {
      if (!_.find(group[key], (el) => !_.isNil(el.positionSetId))) {
        let result = await PatientPositionSet.create({
          name: 'Position set 1',
          bodyPartId: group[key][0].bodyPartId,
        })

        for (let patientPosition of group[key]) {
          _.extend(patientPosition, {
            positionSetId: result.id,
          })

          await patientPosition.save({ transaction })
        }
      }
    }
  })

  return group
}

const ModelService = {
  getPatientPositionSets,
  updatePatientPositionSet,
  addPatientPositionSet,
  deletePatientPositionSet,
  initPatientPositionSet,
}

module.exports = ModelService
