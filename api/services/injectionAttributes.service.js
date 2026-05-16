const { InjectionAttribute, BodyPart, sequelize } = require('../../db/models')
const _ = require('lodash')
// const logger = require('../../util/logger')

const getInjectionAttributesByBodyPartId = async (bodyPartId) => {
  if (_.isNil(bodyPartId)) {
    throw { status: 400, message: 'bodyPartId can not be null' }
  }

  const whereClause = bodyPartId
    ? {
        bodyPartId: bodyPartId,
      }
    : {}

  let result = await InjectionAttribute.findOne({
    order: [['id', 'ASC']],
    attributes: [
      'id',
      'contrastMinDose',
      'contrastMaxDose',
      'contrastMinFlowRate',
      'contrastMaxFlowRate',
      'salineMinDose',
      'salineMaxDose',
      'salineMinFlowRate',
      'salineMaxFlowRate',
      'minTime',
      'posts',
      'maxTime',
      'bodyPartId',
    ],
    include: [
      {
        model: BodyPart,
        as: 'bodyPart',
        attributes: ['id'],
      },
    ],
    where: whereClause,
  })

  return result
}

const updateInjectionAttribute = async (bodyPartId, data) => {
  const bodyPart = await BodyPart.findByPk(bodyPartId)

  if (!bodyPart) {
    throw { status: 400, message: 'body part not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      const current = await getInjectionAttributesByBodyPartId(bodyPartId)
      if (current) {
        _.extend(current, {
          ...data,
        })

        await current.save({ transaction })

        result = current
      } else {
        result = await InjectionAttribute.create(
          {
            bodyPartId,
            ...data,
          },
          { transaction }
        )
      }
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const InjectionAttributesService = {
  getInjectionAttributesByBodyPartId,
  updateInjectionAttribute,
}

module.exports = InjectionAttributesService
