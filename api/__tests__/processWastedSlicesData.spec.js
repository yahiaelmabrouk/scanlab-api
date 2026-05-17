/**
 * Tests for processWastedSlicesData — the per-question aggregator behind
 * GET /v1/statistics/derived/wastedSlices.
 *
 * Validates that rows sharing the same questionSetResultId|questionOrder
 * (multi-slice-group questions) are collapsed to a single averaged value per
 * stack question before any mean/total/individual aggregation, mirroring the
 * behavior of /statistics/factors/angle.
 */

// statistics.js pulls in many modules at require-time; stub everything that
// touches DB/IO so we can import it in a unit test.
jest.mock('../../db/models', () => ({
  User: {},
  Sequelize: { Op: {} },
  CohortStudent: {},
  sequelize: { query: jest.fn(), QueryTypes: { SELECT: 'SELECT' } },
}))

jest.mock('../../util/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

jest.mock('../../util/constants', () => ({ USER_AREA: { US_EAST: 'us-east', EU_WEST: 'eu-west' } }))

jest.mock('../api_util/api_util', () => ({
  fetchLoggedInUser: jest.fn(),
  isManagerOrAdmin: jest.fn(),
  getMineCohortArea: jest.fn(),
  getCohortArea: jest.fn(),
}))

jest.mock('../cacheHelper', () => ({
  getCohortCache: jest.fn(),
  updateCohortCache: jest.fn(),
}))

jest.mock('../providers/model.provider', () => ({}))

jest.mock('../services/statistic.service', () => ({
  getStatisticFactorAngleSql: jest.fn(),
  getDirectAngleSql: jest.fn(),
  expandAngleRows: jest.fn(),
  getStatisticFactorWastedSlicesSql: jest.fn(),
  getDirectWastedSlicesSql: jest.fn(),
  expandWastedSlicesRows: jest.fn(),
}))

jest.mock('../statsCacheHelper', () => ({}))

jest.mock('../../util/sql', () => ({ queryWithTimeout: jest.fn() }))

jest.mock('../api_util/pagination', () => ({
  parsePaginationParams: jest.fn(),
  formatPaginatedResponse: jest.fn(),
}))

const { processWastedSlicesData } = require('../statistics')

// Helper: build a row matching the shape produced by expandWastedSlicesRows /
// getDirectWastedSlicesSql. `tooLow`/`tooHigh` are the raw mm coverage errors;
// `spacing+thickness` define slice size for the wastedSlices ratio.
const row = ({
  questionSetResultId,
  questionOrder,
  tooLow = 0,
  tooHigh = 0,
  spacing = 5,
  thickness = 5,
  bodyPart = 'brain',
  preparedExamId = 100,
  userId = 1,
  createdAt = new Date('2026-01-01T00:00:00Z'),
}) => ({
  questionSetResultId,
  questionOrder,
  sliceCoverageZTooLow: tooLow,
  sliceCoverageZTooHigh: tooHigh,
  answer: [{ spacing, thickness }],
  bodyPart,
  preparedExamId,
  createdAt,
  'questionSetResult.userId': userId,
})

describe('processWastedSlicesData', () => {
  describe('mean path', () => {
    it('returns null means when showMean=false', () => {
      const result = processWastedSlicesData(
        [row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 })],
        false,
        false
      )
      expect(result.wastedSlices.mean).toBeNull()
      expect(result.wastedCoverage.mean).toBeNull()
    })

    it('computes per-question mean for single-slice-group rows', () => {
      // Two questions, one row each. coverage = +10 mm and -20 mm; sliceSize = 10.
      // Per-question slices: 1.0, -2.0 → mean = -0.5.  coverage: 10, -20 → mean = -5.
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }),
        row({ questionSetResultId: 1, questionOrder: 1, tooLow: 20 }),
      ]
      const result = processWastedSlicesData(data, true, false)
      expect(result.wastedSlices.mean).toBeCloseTo(-0.5)
      expect(result.wastedCoverage.mean).toBeCloseTo(-5)
    })

    it('collapses multi-slice-group rows by questionOrder before averaging', () => {
      // One question with 2 slice groups (rows differ only by data, share questionOrder).
      // Without collapsing, slices=(1.0+3.0)/2=2.0; with collapsing it's the same here, so
      // use asymmetric values that prove the collapse. Group A: tooHigh=10,20 → slices 1.0,2.0
      // → per-question = 1.5. Plus a single-row second question with slices=4.0.
      // Expected mean = (1.5 + 4.0) / 2 = 2.75. If multi-group rows leaked through individually
      // it would be (1.0 + 2.0 + 4.0) / 3 = 2.333…
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }), // slices 1.0
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 20 }), // slices 2.0 (same question, different slice group)
        row({ questionSetResultId: 1, questionOrder: 1, tooHigh: 40 }), // slices 4.0
      ]
      const result = processWastedSlicesData(data, true, false)
      expect(result.wastedSlices.mean).toBeCloseTo(2.75)
      expect(result.wastedCoverage.mean).toBeCloseTo(27.5) // ((10+20)/2 + 40) / 2
    })

    it('treats same questionOrder across different exams as separate questions', () => {
      // questionOrder=0 in two different questionSetResultIds → two distinct questions, NOT collapsed.
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }), // slices 1.0
        row({ questionSetResultId: 2, questionOrder: 0, tooHigh: 30 }), // slices 3.0
      ]
      const result = processWastedSlicesData(data, true, false)
      expect(result.wastedSlices.mean).toBeCloseTo(2.0)
    })

    it('drops rows with non-numeric coverage fields before grouping', () => {
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }),
        {
          ...row({ questionSetResultId: 1, questionOrder: 1 }),
          sliceCoverageZTooLow: null,
          sliceCoverageZTooHigh: null,
        },
      ]
      const result = processWastedSlicesData(data, true, false)
      // Only the first row survives → mean reflects that single value.
      expect(result.wastedSlices.mean).toBeCloseTo(1.0)
    })

    it('treats sliceSize=0 as zero coverage (calculateCoverage guard)', () => {
      const data = [row({ questionSetResultId: 1, questionOrder: 0, spacing: 0, thickness: 0, tooHigh: 999 })]
      const result = processWastedSlicesData(data, true, false)
      expect(result.wastedSlices.mean).toBe(0)
      expect(result.wastedCoverage.mean).toBe(0)
    })
  })

  describe('points path', () => {
    it('returns null points when showPoints=false', () => {
      const result = processWastedSlicesData([row({ questionSetResultId: 1, questionOrder: 0 })], false, false)
      expect(result.wastedSlices.points).toBeNull()
      expect(result.wastedCoverage.points).toBeNull()
    })

    it('emits one entry per stack question (not per slice-group row)', () => {
      // Exam 1 has one question with 2 slice groups, plus one single-group question.
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }), // slices 1.0
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 20 }), // slices 2.0 (same question)
        row({ questionSetResultId: 1, questionOrder: 1, tooHigh: 40 }), // slices 4.0
      ]
      const result = processWastedSlicesData(data, false, true)
      expect(result.wastedSlices.points).toHaveLength(1)
      const point = result.wastedSlices.points[0]
      expect(point.values.individual).toEqual([1.5, 4.0])
      expect(point.values.total).toBeCloseTo(5.5)
      expect(point.values.absoluteTotal).toBeCloseTo(5.5)
      expect(point.values.mean).toBeCloseTo(2.75)
    })

    it('signs absoluteTotal independent from total for over/under coverage mix', () => {
      // questionOrder=0: tooHigh=10 → slices=+1.0
      // questionOrder=1: tooLow=20  → slices=-2.0
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }),
        row({ questionSetResultId: 1, questionOrder: 1, tooLow: 20 }),
      ]
      const result = processWastedSlicesData(data, false, true)
      const slicesPoint = result.wastedSlices.points[0]
      const coveragePoint = result.wastedCoverage.points[0]
      expect(slicesPoint.values.individual).toEqual([1.0, -2.0])
      expect(slicesPoint.values.total).toBeCloseTo(-1.0)
      expect(slicesPoint.values.absoluteTotal).toBeCloseTo(3.0)
      expect(coveragePoint.values.individual).toEqual([10, -20])
      expect(coveragePoint.values.total).toBeCloseTo(-10)
      expect(coveragePoint.values.absoluteTotal).toBeCloseTo(30)
    })

    it('sorts entries inside an exam by questionOrder', () => {
      // Insert rows out of order; expect individual array in question order.
      const data = [
        row({ questionSetResultId: 1, questionOrder: 2, tooHigh: 30 }),
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10 }),
        row({ questionSetResultId: 1, questionOrder: 1, tooHigh: 20 }),
      ]
      const result = processWastedSlicesData(data, false, true)
      expect(result.wastedSlices.points[0].values.individual).toEqual([1.0, 2.0, 3.0])
    })

    it('groups points by questionSetResultId so different exams produce separate entries', () => {
      const data = [
        row({ questionSetResultId: 1, questionOrder: 0, tooHigh: 10, preparedExamId: 100 }),
        row({ questionSetResultId: 2, questionOrder: 0, tooHigh: 20, preparedExamId: 200 }),
      ]
      const result = processWastedSlicesData(data, false, true)
      expect(result.wastedSlices.points).toHaveLength(2)
      const ids = result.wastedSlices.points.map((p) => p.questionSetResultId).sort()
      expect(ids).toEqual([1, 2])
    })

    it('exposes shared meta on each point', () => {
      const created = new Date('2026-02-15T12:00:00Z')
      const data = [
        row({
          questionSetResultId: 7,
          questionOrder: 0,
          tooHigh: 10,
          bodyPart: 'knee',
          preparedExamId: 555,
          userId: 42,
          createdAt: created,
        }),
      ]
      const result = processWastedSlicesData(data, false, true)
      const slicesPoint = result.wastedSlices.points[0]
      expect(slicesPoint).toMatchObject({
        bodyPart: 'knee',
        preparedExamId: 555,
        questionSetResultId: 7,
        userId: 42,
        x: created.valueOf(),
      })
    })
  })

  it('returns nulls on both paths when data is empty', () => {
    const result = processWastedSlicesData([], true, true)
    expect(result.wastedSlices.points).toEqual([])
    expect(result.wastedCoverage.points).toEqual([])
    // _.meanBy of [] is NaN — match current behavior; the route serializes NaN→null
    // via isNaN guards in the cohort cache update path, but raw output here is NaN.
    expect(result.wastedSlices.mean).toBeNaN()
    expect(result.wastedCoverage.mean).toBeNaN()
  })
})
