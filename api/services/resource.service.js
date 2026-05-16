const { Resource, sequelize } = require('../../db/models')
const _ = require('lodash')
const { S3_BUCKET, getUploadUrl, deleteObject } = require('../api_util/aws')

const RESOURCE_ORDER = [
  ['categoryId', 'ASC'],
  ['sortOrder', 'ASC'],
  ['id', 'ASC'],
]

const getNextSortOrder = async (categoryId, transaction) => {
  if (!categoryId) {
    return 1
  }

  const maxSortOrder = await Resource.max('sortOrder', {
    where: { categoryId },
    transaction,
  })

  if (!Number.isFinite(maxSortOrder)) {
    return 1
  }

  return maxSortOrder + 1
}

const getAllResources = async () => {
  let where = {}

  let resources = await Resource.findAll({
    where,
    order: RESOURCE_ORDER,
  })

  return resources
}

const getAllViewResources = async () => {
  let where = {}

  let resources = await Resource.findAll({
    where,
    order: RESOURCE_ORDER,
  })

  resources = await Promise.all(resources.map(async (resource) => {
    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      categoryId: resource.categoryId,
      language: resource.language,
      sortOrder: resource.sortOrder,
      url: resource.url,
      path: resource.path ? await getUploadUrl(resource.path) : null,
      pathKey: resource.path,
    }
  }))

  return resources
}

const getResourceById = async (id) => {
  let resource = await Resource.findByPk(id)

  return resource
}

const updateResource = async (id, data) => {
  const resource = await Resource.findOne({
    where: { id },
  })

  if (!resource) {
    throw { status: 400, message: 'Resource not found' }
  }

  let result = {}

  try {
    await sequelize.transaction(async (transaction) => {
      const nextData = { ...data }
      const hasSortOrder = Object.prototype.hasOwnProperty.call(nextData, 'sortOrder')

      if (
        Object.prototype.hasOwnProperty.call(nextData, 'categoryId') &&
        nextData.categoryId !== resource.categoryId &&
        !hasSortOrder
      ) {
        nextData.sortOrder = await getNextSortOrder(nextData.categoryId, transaction)
      }

      _.extend(resource, {
        ...nextData,
      })

      if (data.path && resource.path !== data.path) {
        await deleteObject(S3_BUCKET, data.path)
      }

      await resource.save({ transaction })
      result = resource
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const addResource = async (data) => {
  return sequelize.transaction(async (transaction) => {
    let sortOrder = Number.isInteger(data.sortOrder) ? data.sortOrder : null
    if (!Number.isInteger(sortOrder)) {
      const parsedSortOrder = Number(data.sortOrder)
      sortOrder = Number.isInteger(parsedSortOrder) ? parsedSortOrder : null
    }

    if (!Number.isInteger(sortOrder)) {
      sortOrder = await getNextSortOrder(data.categoryId, transaction)
    }

    const resource = await Resource.create(
      {
        ...data,
        sortOrder,
      },
      { transaction }
    )

    return resource
  })
}

const deleteResource = async (id) => {
  let resource = await Resource.findByPk(id)

  if (resource.path) {
    await deleteObject(S3_BUCKET, resource.path)
  }

  if (!resource) {
    throw { status: 400, message: 'Resource not found' }
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await resource.destroy({ transaction })
    })
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const reorderResources = async (categoryId, resourceIds) => {
  if (!categoryId) {
    throw { status: 400, message: 'Category is required' }
  }

  if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
    return []
  }

  return sequelize.transaction(async (transaction) => {
    const resources = await Resource.findAll({
      where: { id: resourceIds, categoryId },
      transaction,
    })

    if (resources.length !== resourceIds.length) {
      throw { status: 400, message: 'Resource list does not match category' }
    }

    await Promise.all(
      resourceIds.map((id, index) => {
        return Resource.update(
          { sortOrder: index + 1 },
          {
            where: { id },
            transaction,
          }
        )
      })
    )

    return resourceIds
  })
}

const ResourceService = {
  getAllResources,
  addResource,
  updateResource,
  getResourceById,
  getAllViewResources,
  deleteResource,
  reorderResources,
}

module.exports = ResourceService
