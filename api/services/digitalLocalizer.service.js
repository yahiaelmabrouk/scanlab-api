const { DigitalLocalizer } = require('../../db/models')

const createDigitalLocalizer = async (bodyPartId, minStep = 0, maxStep = 339) => {
  try {
    const digitalLocalizer = await DigitalLocalizer.create({
      bodyPartId,
      minStep,
      maxStep,
    })
    return digitalLocalizer
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const getDigitalLocalizerByBodyPartId = async (bodyPartId) => {
  try {
    const digitalLocalizer = await DigitalLocalizer.findOne({
      where: { bodyPartId },
    })
    if (!digitalLocalizer) {
      throw { status: 404, message: 'Digital Localizer not found for the given Body Part ID' }
    }
    return digitalLocalizer
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const updateDigitalLocalizer = async (bodyPartId, updateData) => {
  try {
    const digitalLocalizer = await DigitalLocalizer.findOne({
      where: { bodyPartId },
    })
    if (!digitalLocalizer) {
      throw { status: 404, message: 'Digital Localizer not found for the given Body Part ID' }
    }
    await digitalLocalizer.update(updateData)
    return digitalLocalizer
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const deleteDigitalLocalizer = async (bodyPartId) => {
  try {
    const digitalLocalizer = await DigitalLocalizer.findOne({
      where: { bodyPartId },
    })
    if (!digitalLocalizer) {
      throw { status: 404, message: 'Digital Localizer not found for the given Body Part ID' }
    }
    await digitalLocalizer.destroy()
    return { message: 'Digital Localizer deleted successfully' }
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const getAllDigitalLocalizers = async () => {
  try {
    const digitalLocalizers = await DigitalLocalizer.findAll()
    return digitalLocalizers
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const DigitalLocalizerService = {
  createDigitalLocalizer,
  getDigitalLocalizerByBodyPartId,
  updateDigitalLocalizer,
  deleteDigitalLocalizer,
  getAllDigitalLocalizers,
}

module.exports = DigitalLocalizerService
