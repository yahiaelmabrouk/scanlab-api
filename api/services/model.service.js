const { Model, sequelize } = require('../../db/models')
const { Op } = require('sequelize')
const _ = require('lodash')

const getModels = async (exceptModelId = null, gender = null, age = null) => {
  let where = {}

  if (exceptModelId) {
    where.id = { [Op.ne]: exceptModelId }
  }
  if (gender) {
    where.gender = gender
  }
  if (age != null) {
    where.age = {
      [Op.lte]: +age,
    }
    where.to = {
      [Op.gte]: +age,
    }
  }

  let models = await Model.findAll({
    where,
    order: [['id', 'ASC']],
    attributes: [
      'id',
      'name',
      'fileName',
      'gender',
      'age',
      'to',
      'weightImperial',
      'weightMetric',
      'heightImperial',
      'heightMetric',
      'heightInches',
      'attributes',
    ],
  })

  return models
}

const updateModel = async (id, data) => {
  const model = await Model.findOne({
    where: { id },
  })

  if (!model) {
    throw { status: 400, message: 'Model not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      _.extend(model, {
        ...data,
      })

      await model.save({ transaction })
      result = model
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const ModelService = {
  getModels,
  updateModel,
}

module.exports = ModelService
