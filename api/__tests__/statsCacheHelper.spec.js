/**
 * Tests for statsCacheHelper batch-fetch functions (N+1 fix)
 *
 * Validates:
 *  - batchGetOrRecalcUserStatistics / batchGetOrRecalcUserTests
 *  - Batch SELECT + batch UPDATE instead of per-user queries
 *  - Concurrency-limited recalculation of cache misses
 */

// ─── stubs ───────────────────────────────────────────────────────────────────

const mockFindAll = jest.fn()
const mockUpdate = jest.fn()

// We need to mock the DB models *before* requiring the module under test
jest.mock('../../db/models', () => {
  const Op = {
    in: Symbol('in'),
    or: Symbol('or'),
    notIn: Symbol('notIn'),
  }

  return {
    UserStatsCache: {
      findAll: (...args) => mockFindAll(...args),
      findOne: jest.fn(),
      findOrCreate: jest.fn(),
      update: (...args) => mockUpdate(...args),
    },
    Sequelize: { Op },
    sequelize: {
      query: jest.fn(),
      QueryTypes: { SELECT: 'SELECT' },
    },
  }
})

jest.mock('../../util/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock('../../util/constants', () => ({
  USER_AREA: { US_EAST: 'us-east', EU_WEST: 'eu-west' },
}))

jest.mock('../services/statistic.service', () => ({
  getStatisticSql: jest.fn(),
  getCommentFlagsUSEast: jest.fn().mockResolvedValue({}),
  getCommentFlagsEUWest: jest.fn().mockResolvedValue({}),
  getTestRunAndGroupStackQuestionResultForOneUser: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../util/backgroundLock', () => ({
  tryAcquire: jest.fn().mockReturnValue(true),
  release: jest.fn(),
}))

// ─── import module under test ────────────────────────────────────────────────

const subject = require('../statsCacheHelper')

// ─── tests ───────────────────────────────────────────────────────────────────

describe('statsCacheHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear the in-memory LRU between tests so cached data doesn't leak
    subject._statsLru.clear()
  })

  // ━━━ LRU in-memory cache ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('LRU in-memory cache', () => {
    it('returns data from LRU on second call without hitting DB', async () => {
      const { UserStatsCache } = require('../../db/models')
      const fakeRow = { data: [{ score: 77 }], save: jest.fn().mockResolvedValue() }
      UserStatsCache.findOne.mockResolvedValueOnce(fakeRow)

      // First call: LRU miss → DB findOne
      const first = await subject.getOrRecalcUserStatistics(42, false)
      expect(UserStatsCache.findOne).toHaveBeenCalledTimes(1)
      expect(first).toEqual([{ score: 77 }])

      // Second call: LRU hit → no DB call
      UserStatsCache.findOne.mockClear()
      const second = await subject.getOrRecalcUserStatistics(42, false)
      expect(UserStatsCache.findOne).not.toHaveBeenCalled()
      expect(second).toEqual([{ score: 77 }])
    })

    it('touchLastUsed is fire-and-forget (not awaited) on DB fallback', async () => {
      const { UserStatsCache } = require('../../db/models')
      // save() rejects — should NOT propagate to the caller
      const fakeRow = {
        data: [{ score: 55 }],
        save: jest.fn().mockRejectedValue(new Error('db down')),
      }
      UserStatsCache.findOne.mockResolvedValueOnce(fakeRow)

      // Should NOT throw even though save() fails
      const result = await subject.getOrRecalcUserStatistics(50, false)
      expect(result).toEqual([{ score: 55 }])
      // Give fire-and-forget a tick to settle
      await new Promise((r) => setImmediate(r))
    })

    it('invalidateCachesForUser clears the LRU for that user', async () => {
      const { UserStatsCache } = require('../../db/models')
      // Populate LRU
      subject._statsLru.set(60, 'statistics', false, [{ x: 1 }])
      subject._statsLru.set(60, 'tests_whom', false, [{ y: 2 }])
      subject._statsLru.set(61, 'statistics', false, [{ z: 3 }])

      UserStatsCache.destroy = jest.fn().mockResolvedValue(2)
      await subject.invalidateCachesForUser(60)

      // user 60 entries gone, user 61 still present
      expect(subject._statsLru.get(60, 'statistics', false)).toBeUndefined()
      expect(subject._statsLru.get(60, 'tests_whom', false)).toBeUndefined()
      expect(subject._statsLru.get(61, 'statistics', false)).toEqual([{ z: 3 }])
    })

    it('batch functions populate the LRU so subsequent single reads skip DB', async () => {
      mockFindAll.mockResolvedValue([
        { id: 600, userId: 70, data: [{ score: 99 }] },
      ])
      mockUpdate.mockResolvedValue([1])

      await subject.batchGetOrRecalcUserStatistics([70], false)
      await new Promise((r) => setImmediate(r))

      // Now a single-user read should hit LRU, not DB
      const { UserStatsCache } = require('../../db/models')
      UserStatsCache.findOne.mockClear()
      const result = await subject.getOrRecalcUserStatistics(70, false)
      expect(UserStatsCache.findOne).not.toHaveBeenCalled()
      expect(result).toEqual([{ score: 99 }])
    })
  })

  // ━━━ batchGetOrRecalcUserStatistics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('batchGetOrRecalcUserStatistics', () => {
    it('returns an empty object for an empty userIds array', async () => {
      const result = await subject.batchGetOrRecalcUserStatistics([], false)

      expect(result).toEqual({})
      expect(mockFindAll).not.toHaveBeenCalled()
    })

    it('batch-fetches all cache hits in a single query and batch-updates lastUsed', async () => {
      // Simulate two cache hits
      const fakeRows = [
        { id: 100, userId: 1, data: [{ score: 80 }] },
        { id: 101, userId: 2, data: [{ score: 90 }] },
      ]
      mockFindAll.mockResolvedValue(fakeRows)
      mockUpdate.mockResolvedValue([2])

      const result = await subject.batchGetOrRecalcUserStatistics([1, 2], false)

      // Should issue exactly ONE findAll
      expect(mockFindAll).toHaveBeenCalledTimes(1)
      const findAllArgs = mockFindAll.mock.calls[0][0]
      // Check the where clause contains both userIds
      expect(findAllArgs.where.userId).toBeDefined()
      expect(findAllArgs.where.cacheType).toBe('statistics')
      expect(findAllArgs.where.includeChallengeMode).toBe(false)

      // Should issue exactly ONE batch update for lastUsed (fire-and-forget)
      // Give the fire-and-forget time to execute
      await new Promise((r) => setImmediate(r))
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      const [updateData, updateWhere] = mockUpdate.mock.calls[0]
      expect(updateData).toHaveProperty('lastUsed')
      expect(updateData.lastUsed).toBeInstanceOf(Date)

      // Both users present in the result object
      expect(result[1]).toEqual([{ score: 80 }])
      expect(result[2]).toEqual([{ score: 90 }])
    })

    it('does NOT call batchTouchLastUsed when there are zero cache hits', async () => {
      // All misses — findAll returns empty array
      // Mock findOrCreate for cold-start recalc
      const { UserStatsCache } = require('../../db/models')
      UserStatsCache.findOrCreate.mockResolvedValue([
        { data: [{ score: 55 }], save: jest.fn() },
        true,
      ])

      mockFindAll.mockResolvedValue([])

      const result = await subject.batchGetOrRecalcUserStatistics([5], false)

      // No rows to touch — batchTouchLastUsed should skip
      // Wait for any fire-and-forget
      await new Promise((r) => setImmediate(r))
      expect(mockUpdate).not.toHaveBeenCalled()

      // Cold-start should have produced data for user 5
      expect(result[5]).toBeDefined()
    })

    it('handles null data in cache rows gracefully', async () => {
      mockFindAll.mockResolvedValue([
        { id: 300, userId: 7, data: null },
      ])
      mockUpdate.mockResolvedValue([1])

      const result = await subject.batchGetOrRecalcUserStatistics([7], false)
      // null data should become []
      expect(result[7]).toEqual([])
    })
  })

  // ━━━ batchGetOrRecalcUserTests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('batchGetOrRecalcUserTests', () => {
    it('uses cacheType "tests_whom" for tests batch query', async () => {
      mockFindAll.mockResolvedValue([
        { id: 400, userId: 10, data: [{ test: 'A' }] },
      ])
      mockUpdate.mockResolvedValue([1])

      await subject.batchGetOrRecalcUserTests([10], false)

      const findAllArgs = mockFindAll.mock.calls[0][0]
      expect(findAllArgs.where.cacheType).toBe('tests_whom')
    })

    it('returns empty object for empty userIds', async () => {
      const result = await subject.batchGetOrRecalcUserTests([], false)
      expect(result).toEqual({})
      expect(mockFindAll).not.toHaveBeenCalled()
    })

    it('returns cached data keyed by userId', async () => {
      mockFindAll.mockResolvedValue([
        { id: 500, userId: 11, data: [{ test: 'B' }] },
        { id: 501, userId: 12, data: [{ test: 'C' }] },
      ])
      mockUpdate.mockResolvedValue([2])

      const result = await subject.batchGetOrRecalcUserTests([11, 12], true)
      expect(result[11]).toEqual([{ test: 'B' }])
      expect(result[12]).toEqual([{ test: 'C' }])
    })
  })

  // ━━━ warmCohortCachesInBackground ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('warmCohortCachesInBackground', () => {
    it('skips users that already have both cache types', async () => {
      // Simulate both statistics + tests_whom rows exist for user 20
      mockFindAll.mockResolvedValue([
        { userId: 20, cacheType: 'statistics' },
        { userId: 20, cacheType: 'tests_whom' },
      ])

      subject.warmCohortCachesInBackground([20], false)

      // Allow background promise to settle
      await new Promise((r) => setTimeout(r, 50))

      // findAll called once (to check existing rows), no findOrCreate for recalc
      expect(mockFindAll).toHaveBeenCalledTimes(1)
    })

    it('recalcs users missing cache rows', async () => {
      const { UserStatsCache, sequelize: mockSequelize } = require('../../db/models')
      const StatisticService = require('../services/statistic.service')

      // Setup mocks for the full recalc path (buildStatisticsForUser + buildTestsForUser)
      StatisticService.getStatisticSql.mockReturnValue('SELECT 1')
      mockSequelize.query.mockResolvedValue([]) // no raw stat rows
      StatisticService.getCommentFlagsUSEast.mockResolvedValue({})
      StatisticService.getCommentFlagsEUWest.mockResolvedValue({})
      StatisticService.getTestRunAndGroupStackQuestionResultForOneUser.mockResolvedValue([])

      UserStatsCache.findOrCreate.mockResolvedValue([
        { data: [], save: jest.fn() },
        true,
      ])

      // First call: warm check — no existing rows
      mockFindAll.mockResolvedValue([])

      subject.warmCohortCachesInBackground([30], false)

      // Let the background work complete
      await new Promise((r) => setTimeout(r, 300))

      // findAll called at least once for the warm check
      expect(mockFindAll).toHaveBeenCalled()
      // findOrCreate should have been called for recalc (stats + tests)
      expect(UserStatsCache.findOrCreate).toHaveBeenCalled()
    })

    it('does not start duplicate warm jobs for the same cohort+mode', async () => {
      mockFindAll.mockImplementation(() => new Promise((r) => setTimeout(() => r([]), 100)))

      subject.warmCohortCachesInBackground([40], false)
      subject.warmCohortCachesInBackground([40], false) // duplicate — should be skipped

      await new Promise((r) => setTimeout(r, 300))

      // The warm check findAll should only fire once
      const warmCheckCalls = mockFindAll.mock.calls.filter(
        (call) => call[0]?.attributes !== undefined
      )
      expect(warmCheckCalls.length).toBe(1)
    })
  })

  // ━━━ buildStatisticsForUser parallelises comment flags ━━━━━━━━━━━━━━━━━━

  describe('comment flag parallelisation', () => {
    it('calls both getCommentFlags* queries concurrently via Promise.all', async () => {
      const StatisticService = require('../services/statistic.service')
      const { sequelize: mockSequelize } = require('../../db/models')

      // Make getStatisticSql return something and sequelize.query return rows
      StatisticService.getStatisticSql.mockReturnValue('SELECT 1')
      mockSequelize.query.mockResolvedValue([
        { questionSetResultId: 1, cohortArea: 'us-east' },
        { questionSetResultId: 2, cohortArea: 'eu-west' },
      ])

      // Track call order
      const callOrder = []
      StatisticService.getCommentFlagsUSEast.mockImplementation(() => {
        callOrder.push('useast')
        return Promise.resolve({})
      })
      StatisticService.getCommentFlagsEUWest.mockImplementation(() => {
        callOrder.push('euwest')
        return Promise.resolve({})
      })

      // Trigger a cold-start recalc which internally calls buildStatisticsForUser
      const { UserStatsCache } = require('../../db/models')
      UserStatsCache.findOrCreate.mockResolvedValue([
        { data: [], save: jest.fn() },
        true,
      ])

      // getOrRecalcUserStatistics with no cached row triggers buildStatisticsForUser
      UserStatsCache.findOne.mockResolvedValue(null)
      await subject.getOrRecalcUserStatistics(99, false)

      // Both flag queries should have been called
      expect(StatisticService.getCommentFlagsUSEast).toHaveBeenCalledTimes(1)
      expect(StatisticService.getCommentFlagsEUWest).toHaveBeenCalledTimes(1)
    })
  })
})
