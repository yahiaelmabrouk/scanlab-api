const { PatientPhysio, PatientPhysioCardiacLevel, sequelize } = require('../../db/models')
const _ = require('lodash')
const { CARDIAC_LEVEL } = require('../../util/constants')

const getAllPatientPhysios = async () => {
  let patientPhysios = await PatientPhysio.findAll({
    order: [['id', 'ASC']],
    attributes: [
      'id',
      'name',
      'age',
      'respiratoryCycleDuration',
      'strokeVol',
      'breathHoldDuration',
      'unit',
      'difficulty',
    ],
    include: {
      model: PatientPhysioCardiacLevel,
      as: 'cardiacLevels',
    },
  })

  return patientPhysios || []
}

const updatePatientPhysio = async (id, data) => {
  const updateData = _.pick(data, [
    'name',
    'age',
    'respiratoryCycleDuration',
    'strokeVol',
    'breathHoldDuration',
    'unit',
    'difficulty',
  ])
  const patientPhysio = await PatientPhysio.findOne({
    where: { id },
  })

  if (!patientPhysio) {
    throw { status: 400, message: 'PatientPhysio not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      _.extend(patientPhysio, {
        ...updateData,
      })

      await patientPhysio.save({ transaction })

      const cardiacLevels = _.get(data, 'cardiacLevels', [])
      for (let i = 0; i < cardiacLevels.length; i++) {
        const level = await PatientPhysioCardiacLevel.findOne({
          where: { patientPhysioId: patientPhysio.id, levelType: cardiacLevels[i].levelType },
        })
        if (level) {
          _.extend(level, {
            ..._.pick(cardiacLevels[i], [
              'cardiacCycleDuration',
              'cardiacCycleDeviation',
              'badBeats',
              'badBeatsDuration',
              'continuousECGData',
            ]),
          })
          await level.save({ transaction })
        } else {
          await PatientPhysioCardiacLevel.create(
            {
              ...cardiacLevels[i],
              patientPhysioId: patientPhysio.id,
            },
            { transaction }
          )
        }
      }

      result = patientPhysio
    })

    return await getPatientPhysioById(result.id)
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const getPatientPhysioById = async (id) => {
  const set = await PatientPhysio.findOne({
    where: { id },
    include: {
      model: PatientPhysioCardiacLevel,
      as: 'cardiacLevels',
    },
  })

  if (!set) {
    throw { status: 400, message: 'PatientPhysio not found' }
  }

  return set
}

const getRandomPatientPhysio = async () => {
  const sets = await getAllPatientPhysios()
  const randomProfie = _.sample(sets)
  const data = randomProfie.toJSON()
  const initialCardiac = _.find(_.get(data, 'cardiacLevels', []), (el) => el.levelType == CARDIAC_LEVEL.INITIAL)
  _.extend(data, {
    cardiacLevel: initialCardiac || _.sample(_.get(data, 'cardiacLevels', [])),
  })
  return data
}

const getPatientPhysioByIdWithInitialLevel = async (id) => {
  const profile = await getPatientPhysioById(id)
  const data = profile.toJSON()
  const initialCardiac = _.find(_.get(data, 'cardiacLevels', []), (el) => el.levelType == CARDIAC_LEVEL.INITIAL)
  _.extend(data, {
    cardiacLevel: initialCardiac || _.sample(_.get(data, 'cardiacLevels', [])),
  })
  return data
}

const deletePatientPhysio = async (id) => {
  const set = await PatientPhysio.findOne({
    where: { id },
  })

  if (!set) {
    throw { status: 400, message: 'PatientPhysio not found' }
  }

  await set.destroy()

  return null
}

const addPatientPhysio = async (data) => {
  const addData = _.pick(data, [
    'name',
    'age',
    'respiratoryCycleDuration',
    'strokeVol',
    'breathHoldDuration',
    'unit',
    'difficulty',
  ])
  let result = await PatientPhysio.create(addData)

  const cardiacLevels = _.get(data, 'cardiacLevels', [])
  for (let i = 0; i < cardiacLevels.length; i++) {
    await PatientPhysioCardiacLevel.create({
      ...cardiacLevels[i],
      patientPhysioId: result.id,
    })
  }

  return await getPatientPhysioById(result.id)
}

const PatientPhysioService = {
  getAllPatientPhysios,
  updatePatientPhysio,
  deletePatientPhysio,
  getPatientPhysioById,
  addPatientPhysio,
  getRandomPatientPhysio,
  getPatientPhysioByIdWithInitialLevel,
}
module.exports = PatientPhysioService
