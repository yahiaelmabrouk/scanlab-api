/* eslint-disable no-undef */
const {
  parsePaginationParams,
  getSequelizePagination,
  formatPaginatedResponse,
  paginateArray,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../pagination')

describe('Pagination Utility', () => {
  describe('#parsePaginationParams', () => {
    it('should use default limit and offset when not provided', () => {
      const result = parsePaginationParams({})
      
      expect(result.limit).toBe(DEFAULT_LIMIT)
      expect(result.offset).toBe(0)
    })

    it('should parse valid limit and offset from query', () => {
      const result = parsePaginationParams({ limit: '25', offset: '100' })
      
      expect(result.limit).toBe(25)
      expect(result.offset).toBe(100)
    })

    it('should cap limit at MAX_LIMIT', () => {
      const result = parsePaginationParams({ limit: '1000' })
      
      expect(result.limit).toBe(MAX_LIMIT)
    })

    it('should use default limit for invalid values', () => {
      const result = parsePaginationParams({ limit: 'invalid', offset: '-10' })
      
      expect(result.limit).toBe(DEFAULT_LIMIT)
      expect(result.offset).toBe(0)
    })

    it('should use default limit when limit is less than 1', () => {
      const result = parsePaginationParams({ limit: '0' })
      
      expect(result.limit).toBe(DEFAULT_LIMIT)
    })

    it('should accept custom default limit', () => {
      const result = parsePaginationParams({}, { defaultLimit: 100 })
      
      expect(result.limit).toBe(100)
    })

    it('should accept custom max limit', () => {
      const result = parsePaginationParams({ limit: '300' }, { maxLimit: 200 })
      
      expect(result.limit).toBe(200)
    })
  })

  describe('#getSequelizePagination', () => {
    it('should return pagination params for Sequelize', () => {
      const result = getSequelizePagination({ limit: '10', offset: '20' })
      
      expect(result).toEqual({ limit: 10, offset: 20 })
    })
  })

  describe('#formatPaginatedResponse', () => {
    it('should format response with pagination metadata', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const pagination = { limit: 10, offset: 0 }
      
      const result = formatPaginatedResponse(data, pagination)
      
      expect(result.data).toEqual(data)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.offset).toBe(0)
      expect(result.pagination.count).toBe(2)
    })

    it('should include total and hasMore when totalCount is provided', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const pagination = { limit: 10, offset: 0 }
      
      const result = formatPaginatedResponse(data, pagination, 100)
      
      expect(result.pagination.total).toBe(100)
      expect(result.pagination.hasMore).toBe(true)
    })

    it('should set hasMore to false when no more records', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const pagination = { limit: 10, offset: 0 }
      
      const result = formatPaginatedResponse(data, pagination, 2)
      
      expect(result.pagination.hasMore).toBe(false)
    })
  })

  describe('#paginateArray', () => {
    it('should return paginated slice of array', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      
      const result = paginateArray(array, { limit: 3, offset: 2 })
      
      expect(result).toEqual([3, 4, 5])
    })

    it('should handle offset beyond array length', () => {
      const array = [1, 2, 3]
      
      const result = paginateArray(array, { limit: 10, offset: 10 })
      
      expect(result).toEqual([])
    })
  })
})
