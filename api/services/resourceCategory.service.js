const { ResourceCategory, Resource, sequelize } = require('../../db/models')
const _ = require('lodash')
const { getUploadUrl } = require('../api_util/aws')

const getAllResourceCategories = async () => {
  let where = {}

  let categories = await ResourceCategory.findAll({
    where,
    order: [['id', 'ASC']],
  })

  return categories
}

const addResourceCategory = async (data) => {
  let category = await ResourceCategory.create(data)
  return category
}

const deleteResourceCategory = async (id) => {
  let category = await ResourceCategory.findByPk(id)

  if (!category) {
    throw { status: 400, message: 'Category not found' }
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await category.destroy({ transaction })
    })
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const updateResourceCategory = async (id, data) => {
  const category = await ResourceCategory.findOne({
    where: { id },
  })

  if (!category) {
    throw { status: 400, message: 'Category not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      _.extend(category, {
        ...data,
      })

      await category.save({ transaction })
      result = category
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const getResourceCategoryById = async (id, languageCode) => {
  const resourceWhere = {}
  if (languageCode) {
    resourceWhere.language = languageCode
  }

  let category = await ResourceCategory.findByPk(id, {
    include: [
      {
        required: false,
        model: Resource,
        where: resourceWhere,
        as: 'resources',
      },
    ],
    order: [
      [{ model: Resource, as: 'resources' }, 'sortOrder', 'ASC'],
      [{ model: Resource, as: 'resources' }, 'id', 'ASC'],
    ],
  })

  if (!category) {
    throw { status: 404, message: 'Category not found' }
  }

  // Convert category to a plain JavaScript object
  category = category.toJSON()

  category.resources = await Promise.all(category.resources.map(async (resource) => {
    _.extend(resource, {
      path: resource.path ? await getUploadUrl(resource.path) : null,
      pathKey: resource.path,
    })

    return resource
  }))

  return category
}

const ResourceCategoryService = {
  getAllResourceCategories,
  addResourceCategory,
  deleteResourceCategory,
  updateResourceCategory,
  getResourceCategoryById,
}

module.exports = ResourceCategoryService
