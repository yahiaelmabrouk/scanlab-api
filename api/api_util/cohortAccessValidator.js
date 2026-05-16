/**
 * Middleware to validate that API keys can only access data from their associated cohort
 */
const _ = require('lodash')

/**
 * Validates that an API key can only access cohort data for its own cohort
 * @param {string} paramName - The name of the route parameter containing the cohort ID (default: 'id')
 * @returns {Function} Express middleware function
 */
function validateCohortAccess(paramName = 'id') {
  return function (req, res, next) {
    // Skip validation if not using API key authentication
    if (!req.session || !req.session.apiKey) {
      return next()
    }

    const apiKey = req.session.apiKey
    const requestedCohortId = parseInt(req.params[paramName], 10)

    // Validate that the requested cohort ID matches the API key's cohort
    if (apiKey.cohortId !== requestedCohortId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: API key can only access data from its associated cohort',
        code: 'COHORT_ACCESS_DENIED',
      })
    }

    // API key is authorized for this cohort
    next()
  }
}

/**
 * Validates that an API key can only access cohort data when cohort ID is in query parameters
 * @param {string} queryParam - The name of the query parameter containing the cohort ID
 * @returns {Function} Express middleware function
 */
function validateCohortAccessFromQuery(queryParam = 'cohortId') {
  return function (req, res, next) {
    // Skip validation if not using API key authentication
    if (!req.session || !req.session.apiKey) {
      return next()
    }

    const apiKey = req.session.apiKey
    const requestedCohortId = parseInt(req.query[queryParam], 10)

    // If no cohort ID in query, allow through (other validation will handle this)
    if (!requestedCohortId) {
      return next()
    }

    // Validate that the requested cohort ID matches the API key's cohort
    if (apiKey.cohortId !== requestedCohortId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: API key can only access data from its associated cohort',
        code: 'COHORT_ACCESS_DENIED',
      })
    }

    // API key is authorized for this cohort
    next()
  }
}

/**
 * Filters request body to ensure API key can only create/update data for its cohort
 * @param {string} bodyField - The name of the body field containing the cohort ID (default: 'cohortId')
 * @returns {Function} Express middleware function
 */
function validateCohortAccessFromBody(bodyField = 'cohortId') {
  return function (req, res, next) {
    // Skip validation if not using API key authentication
    if (!req.session || !req.session.apiKey) {
      return next()
    }

    const apiKey = req.session.apiKey
    const requestedCohortId = req.body[bodyField]

    // If cohort ID is provided in body, validate it matches API key's cohort
    if (requestedCohortId !== undefined) {
      const cohortId = parseInt(requestedCohortId, 10)
      if (apiKey.cohortId !== cohortId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: API key can only create/update data for its associated cohort',
          code: 'COHORT_ACCESS_DENIED',
        })
      }
    } else {
      // If no cohort ID provided, auto-set it to API key's cohort
      req.body[bodyField] = apiKey.cohortId
    }

    // API key is authorized for this cohort
    next()
  }
}

/**
 * Validates cohort access for resources that are associated with a cohort through a relationship
 * This middleware looks up the resource and checks if it belongs to the API key's cohort
 * @param {Object} options - Configuration options
 * @param {Object} options.model - Sequelize model to query
 * @param {string} options.paramName - Route parameter name (default: 'id')
 * @param {string} options.cohortField - Field name that contains the cohort ID (default: 'cohortId')
 * @param {Array} options.include - Sequelize include array for associations (optional)
 * @returns {Function} Express middleware function
 */
function validateCohortAccessForResource(options) {
  const { model, paramName = 'id', cohortField = 'cohortId', include = [] } = options

  return async function (req, res, next) {
    // Skip validation if not using API key authentication
    if (!req.session || !req.session.apiKey) {
      return next()
    }

    const apiKey = req.session.apiKey
    const resourceId = req.params[paramName]

    try {
      // Find the resource
      const resource = await model.findOne({
        where: { id: resourceId },
        include,
      })

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
        })
      }

      // Get cohort ID from the resource
      const resourceCohortId =
        include.length > 0 && cohortField.includes('.') ? _.get(resource, cohortField) : resource[cohortField]

      // Validate that the resource's cohort matches the API key's cohort
      if (resourceCohortId !== apiKey.cohortId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: API key can only access resources from its associated cohort',
          code: 'COHORT_ACCESS_DENIED',
        })
      }

      // Store the resource in request for reuse
      req.validatedResource = resource
      next()
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Error validating cohort access',
        code: 'VALIDATION_ERROR',
      })
    }
  }
}

module.exports = {
  validateCohortAccess,
  validateCohortAccessFromQuery,
  validateCohortAccessFromBody,
  validateCohortAccessForResource,
}
