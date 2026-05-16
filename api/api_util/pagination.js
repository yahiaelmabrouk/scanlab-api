/**
 * Pagination utility for API endpoints
 * Provides standardized pagination parameter parsing and response formatting
 */

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @param {Object} options - Options for pagination defaults
 * @param {number} options.defaultLimit - Default limit if not provided (default: 50)
 * @param {number} options.maxLimit - Maximum allowed limit (default: 500)
 * @returns {Object} { limit, offset } parsed values
 */
function parsePaginationParams(query, options = {}) {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT
  const maxLimit = options.maxLimit || MAX_LIMIT

  let limit = parseInt(query.limit, 10)
  let offset = parseInt(query.offset, 10)

  // Validate and set defaults
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit
  }
  if (limit > maxLimit) {
    limit = maxLimit
  }

  if (isNaN(offset) || offset < 0) {
    offset = 0
  }

  return { limit, offset }
}

/**
 * Get Sequelize pagination options
 * @param {Object} query - Express request query object
 * @param {Object} options - Options for pagination defaults
 * @returns {Object} { limit, offset } for Sequelize findAll
 */
function getSequelizePagination(query, options = {}) {
  return parsePaginationParams(query, options)
}

/**
 * Format paginated response with metadata
 * @param {Array} data - Array of results
 * @param {Object} pagination - { limit, offset } used for the query
 * @param {number} totalCount - Total count of records (optional)
 * @returns {Object} Formatted response with pagination metadata
 */
function formatPaginatedResponse(data, pagination, totalCount = null) {
  const response = {
    data,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      count: data.length,
    },
  }

  if (totalCount !== null) {
    response.pagination.total = totalCount
    response.pagination.hasMore = pagination.offset + data.length < totalCount
  }

  return response
}

/**
 * Apply pagination to an in-memory array
 * @param {Array} array - Array to paginate
 * @param {Object} pagination - { limit, offset }
 * @returns {Array} Paginated slice of the array
 */
function paginateArray(array, pagination) {
  const { limit, offset } = pagination
  return array.slice(offset, offset + limit)
}

module.exports = {
  parsePaginationParams,
  getSequelizePagination,
  formatPaginatedResponse,
  paginateArray,
  DEFAULT_LIMIT,
  MAX_LIMIT,
}
