// Mock all heavy dependencies so we can test pure JS expansion helpers in isolation
jest.mock('../../../db/models', () => ({
  sequelize: { query: jest.fn(), QueryTypes: { SELECT: 'SELECT' } },
  Sequelize: { Op: {} },
}))
jest.mock('../../providers/model.provider', () => ({ generateCombinedQuery: jest.fn() }))
jest.mock('../../api_util/api_util', () => ({ getMineCohortArea: jest.fn() }))
jest.mock('../../../util/sql', () => ({ whereObjectToSql: jest.fn() }))

const StatisticService = require('../statistic.service')

const {
  expandAngleRows,
  expandWastedSlicesRows,
  getFirstSliceQuantScore,
  getDirectAngleSql,
  getDirectWastedSlicesSql,
} = StatisticService

// Build a single sliceGroup as it appears under sliceQuantScores.slicePrescription[i].
const buildGroup = ({
  angleOff = null,
  angleIgnore = false,
  coverageZTooLow = null,
  coverageZTooHigh = null,
  coverageZIgnore = false,
} = {}) => ({
  rubric: {
    factors: {
      angle: { ignore: angleIgnore },
      coverageZ: { ignore: coverageZIgnore },
    },
  },
  groupScoreVariables: { scoreVariables: { angleOff, coverageZTooLow, coverageZTooHigh } },
})

const buildSliceQuantScores = (groups) => ({
  combinedScore: 50,
  slicePrescription: { combinedScoreAvg: 50, sliceGroups: groups },
})

// CT shape: single slicePrescriptionScore object with rubric at root and an
// array `groupScoreVariables: [{scoreVariables: ...}]`.
const buildCtSliceQuantScores = ({
  angleOff = null,
  angleIgnore = false,
  coverageZTooLow = null,
  coverageZTooHigh = null,
  coverageZIgnore = false,
} = {}) => ({
  combinedScore: 36.4,
  slicePrescriptionScore: {
    rubric: {
      factors: {
        angle: { ignore: angleIgnore },
        coverageZ: { ignore: coverageZIgnore },
      },
    },
    groupScoreVariables: [{ scoreVariables: { angleOff, coverageZTooLow, coverageZTooHigh } }],
  },
})

describe('getFirstSliceQuantScore', () => {
  it('returns null for null/undefined', () => {
    expect(getFirstSliceQuantScore(null)).toBeNull()
    expect(getFirstSliceQuantScore(undefined)).toBeNull()
  })

  it('returns first element of array', () => {
    expect(getFirstSliceQuantScore([{ a: 1 }, { a: 2 }])).toEqual({ a: 1 })
  })

  it('returns null for empty array', () => {
    expect(getFirstSliceQuantScore([])).toBeNull()
  })

  it('returns object directly if not an array', () => {
    const obj = { slicePrescription: [] }
    expect(getFirstSliceQuantScore(obj)).toBe(obj)
  })
})

describe('expandAngleRows', () => {
  afterEach(() => {
    delete process.env.APP_MODALITY
  })

  it('emits one row per slice group from sliceQuantScores.slicePrescription', () => {
    const rows = [
      {
        createdAt: new Date('2025-01-01'),
        questionSetResultId: 10,
        bodyPart: 'Lumbar',
        bodyPartId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ angleOff: 12.5 }),
          buildGroup({ angleOff: 6.4 }),
          buildGroup({ angleOff: 1.0 }),
        ]),
        'questionSetResult.userId': 42,
        questionOrder: 1,
        preparedExamId: 100,
      },
    ]
    const result = expandAngleRows(rows)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.sliceQuantAngleOff)).toEqual([12.5, 6.4, 1.0])
    expect(result[0].bodyPart).toBe('Lumbar')
    expect(result[0]['questionSetResult.userId']).toBe(42)
  })

  it('drops only the slice groups with angle.ignore = true', () => {
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ angleOff: 5, angleIgnore: false }),
          buildGroup({ angleOff: 10, angleIgnore: true }),
          buildGroup({ angleOff: 15, angleIgnore: false }),
        ]),
        'questionSetResult.userId': 1,
      },
    ]
    const result = expandAngleRows(rows)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.sliceQuantAngleOff)).toEqual([5, 15])
  })

  it('skips slice groups whose angleOff is null', () => {
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ angleOff: null }),
          buildGroup({ angleOff: 7 }),
        ]),
        'questionSetResult.userId': 1,
      },
    ]
    const result = expandAngleRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].sliceQuantAngleOff).toBe(7)
  })

  it('drops rows where sliceQuantScores has no slicePrescription (combinedScore-only)', () => {
    process.env.APP_MODALITY = 'MR'
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: { combinedScore: 80 },
        groupScoreVariables: [{ scoreVariables: { angleOff: 9 } }],
        'questionSetResult.userId': 1,
      },
    ]
    expect(expandAngleRows(rows)).toHaveLength(0)
  })

  it('drops rows in CT mode when sliceQuantScores is null', () => {
    process.env.APP_MODALITY = 'CT'
    expect(expandAngleRows([{ rawSliceQuantScores: null, questionSetResultId: 1 }])).toHaveLength(0)
  })

  describe('CT shape (slicePrescriptionScore)', () => {
    it('emits one row from slicePrescriptionScore.groupScoreVariables[0].scoreVariables.angleOff', () => {
      const rows = [
        {
          questionSetResultId: 1,
          bodyPart: 'Brain',
          rawSliceQuantScores: buildCtSliceQuantScores({ angleOff: 4.2 }),
          'questionSetResult.userId': 1,
        },
      ]
      const result = expandAngleRows(rows)
      expect(result).toHaveLength(1)
      expect(result[0].sliceQuantAngleOff).toBe(4.2)
    })

    it('drops CT rows where angle.ignore = true', () => {
      const rows = [
        {
          questionSetResultId: 1,
          rawSliceQuantScores: buildCtSliceQuantScores({ angleOff: 4.2, angleIgnore: true }),
          'questionSetResult.userId': 1,
        },
      ]
      expect(expandAngleRows(rows)).toHaveLength(0)
    })
  })

  describe('legacy fallback to outer groupScoreVariables', () => {
    const legacyRows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: null,
        groupScoreVariables: [
          { scoreVariables: { angle: 5.5, angleOff: 2.1 } },
          { scoreVariables: { angle: 3.0, angleOff: 1.0 } },
        ],
        'questionSetResult.userId': 42,
      },
    ]

    it('expands one row per legacy GSV element using angleOff in MR mode', () => {
      process.env.APP_MODALITY = 'MR'
      const result = expandAngleRows(legacyRows)
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.sliceQuantAngleOff)).toEqual([2.1, 1.0])
    })

    it('falls back to angle when angleOff is missing in legacy GSV', () => {
      process.env.APP_MODALITY = 'MR'
      const rows = [
        {
          questionSetResultId: 1,
          rawSliceQuantScores: null,
          groupScoreVariables: [{ scoreVariables: { angle: 9 } }],
          'questionSetResult.userId': 1,
        },
      ]
      const result = expandAngleRows(rows)
      expect(result).toHaveLength(1)
      expect(result[0].sliceQuantAngleOff).toBe(9)
    })

    it('drops legacy rows in CT mode', () => {
      process.env.APP_MODALITY = 'CT'
      expect(expandAngleRows(legacyRows)).toHaveLength(0)
    })
  })
})

describe('expandWastedSlicesRows', () => {
  afterEach(() => {
    delete process.env.APP_MODALITY
  })

  it('emits one row per slice group with coverageZTooLow/High', () => {
    const rows = [
      {
        createdAt: new Date('2025-01-01'),
        questionSetResultId: 10,
        bodyPart: 'Lumbar',
        bodyPartId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ coverageZTooLow: 3.21, coverageZTooHigh: 9.205 }),
          buildGroup({ coverageZTooLow: 1.524, coverageZTooHigh: 3.275 }),
        ]),
        answer: [{ spacing: 1, thickness: 2 }],
        'questionSetResult.userId': 42,
        questionOrder: 1,
        preparedExamId: 100,
      },
    ]
    const result = expandWastedSlicesRows(rows)
    expect(result).toHaveLength(2)
    expect(result[0].sliceCoverageZTooLow).toBe(3.21)
    expect(result[0].sliceCoverageZTooHigh).toBe(9.205)
    expect(result[1].sliceCoverageZTooLow).toBe(1.524)
    expect(result[0].answer).toEqual([{ spacing: 1, thickness: 2 }])
  })

  it('drops only the slice groups with coverageZ.ignore = true', () => {
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ coverageZTooLow: 5, coverageZTooHigh: 10, coverageZIgnore: false }),
          buildGroup({ coverageZTooLow: 7, coverageZTooHigh: 14, coverageZIgnore: true }),
        ]),
        answer: [{ spacing: 1, thickness: 2 }],
        'questionSetResult.userId': 1,
      },
    ]
    const result = expandWastedSlicesRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].sliceCoverageZTooLow).toBe(5)
  })

  it('skips groups where slice coverage values are missing', () => {
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: buildSliceQuantScores([
          buildGroup({ coverageZTooLow: null, coverageZTooHigh: null }),
          buildGroup({ coverageZTooLow: 2, coverageZTooHigh: 4 }),
        ]),
        answer: [{ spacing: 1, thickness: 2 }],
        'questionSetResult.userId': 1,
      },
    ]
    const result = expandWastedSlicesRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].sliceCoverageZTooLow).toBe(2)
  })

  it('drops rows where sliceQuantScores has no slicePrescription (combinedScore-only)', () => {
    process.env.APP_MODALITY = 'MR'
    const rows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: { combinedScore: 60 },
        groupScoreVariables: [{ scoreVariables: { coverageZTooLow: 1, coverageZTooHigh: 2 } }],
        answer: [{ spacing: 1, thickness: 2 }],
        'questionSetResult.userId': 1,
      },
    ]
    expect(expandWastedSlicesRows(rows)).toHaveLength(0)
  })

  it('skips rows with no sliceQuantScores in CT mode', () => {
    process.env.APP_MODALITY = 'CT'
    expect(expandWastedSlicesRows([{ rawSliceQuantScores: null, questionSetResultId: 1 }])).toHaveLength(0)
  })

  describe('CT shape (slicePrescriptionScore)', () => {
    it('emits one row from slicePrescriptionScore.groupScoreVariables[0].scoreVariables', () => {
      const rows = [
        {
          questionSetResultId: 1,
          bodyPart: 'Brain',
          rawSliceQuantScores: buildCtSliceQuantScores({ coverageZTooLow: 0, coverageZTooHigh: 9.272 }),
          answer: [{ spacing: 3, thickness: 3 }],
          'questionSetResult.userId': 1,
        },
      ]
      const result = expandWastedSlicesRows(rows)
      expect(result).toHaveLength(1)
      expect(result[0].sliceCoverageZTooLow).toBe(0)
      expect(result[0].sliceCoverageZTooHigh).toBe(9.272)
    })

    it('drops CT rows where coverageZ.ignore = true', () => {
      const rows = [
        {
          questionSetResultId: 1,
          rawSliceQuantScores: buildCtSliceQuantScores({
            coverageZTooLow: 0,
            coverageZTooHigh: 9.272,
            coverageZIgnore: true,
          }),
          answer: [{ spacing: 1, thickness: 2 }],
          'questionSetResult.userId': 1,
        },
      ]
      expect(expandWastedSlicesRows(rows)).toHaveLength(0)
    })
  })

  describe('legacy fallback to outer groupScoreVariables', () => {
    const legacyRows = [
      {
        questionSetResultId: 1,
        rawSliceQuantScores: null,
        groupScoreVariables: [
          { scoreVariables: { coverageZTooLow: 1.5, coverageZTooHigh: 3.2 } },
          { scoreVariables: { coverageZTooLow: 0.5, coverageZTooHigh: 1.0 } },
        ],
        answer: [{ spacing: 1, thickness: 2 }],
        'questionSetResult.userId': 1,
      },
    ]

    it('expands legacy rows in MR mode', () => {
      process.env.APP_MODALITY = 'MR'
      const result = expandWastedSlicesRows(legacyRows)
      expect(result).toHaveLength(2)
      expect(result[0].sliceCoverageZTooLow).toBe(1.5)
      expect(result[1].sliceCoverageZTooHigh).toBe(1.0)
    })

    it('drops legacy rows in CT mode', () => {
      process.env.APP_MODALITY = 'CT'
      expect(expandWastedSlicesRows(legacyRows)).toHaveLength(0)
    })
  })
})

describe('getDirectAngleSql', () => {
  it('uses public schema for us_east region', () => {
    const sql = getDirectAngleSql('123', 'us_east', null)
    expect(sql).toContain('"StackQuestionResults" sqr')
    expect(sql).toContain('"QuestionSetResults" qsr')
    expect(sql).toContain('"TestRuns" tr')
    expect(sql).not.toContain('eu_west_server_public')
    expect(sql).toContain('qsr."userId" = 123')
  })

  it('uses eu_west schema prefix for eu_west region', () => {
    const sql = getDirectAngleSql('456', 'eu_west', null)
    expect(sql).toContain('"eu_west_server_public"."StackQuestionResults" sqr')
    expect(sql).toContain('"eu_west_server_public"."QuestionSetResults" qsr')
    expect(sql).toContain('"eu_west_server_public"."TestRuns" tr')
    expect(sql).toMatch(/INNER JOIN "QuestionSets" qs/)
    expect(sql).toMatch(/INNER JOIN "BodyParts" bp/)
    expect(sql).toMatch(/LEFT JOIN "StackQuestions" sq/)
  })

  it('includes body part filter when bodyParts provided', () => {
    const sql = getDirectAngleSql('123', 'us_east', ['Knee', 'Spine'])
    expect(sql).toContain(`bp."name" IN ('Knee', 'Spine')`)
  })

  it('omits body part filter when bodyParts is null or empty', () => {
    expect(getDirectAngleSql('123', 'us_east', null)).not.toContain('bp."name" IN')
    expect(getDirectAngleSql('123', 'us_east', [])).not.toContain('bp."name" IN')
  })

  it('sanitizes userId via parseInt', () => {
    const sql = getDirectAngleSql('123; DROP TABLE users', 'us_east', null)
    expect(sql).toContain('qsr."userId" = 123')
    expect(sql).not.toContain('DROP TABLE')
  })

  it('throws for non-numeric userId', () => {
    expect(() => getDirectAngleSql('abc', 'us_east', null)).toThrow('Invalid userId')
  })

  it('expands sliceQuantScores.slicePrescription.sliceGroups via LATERAL and reads angleOff', () => {
    const sql = getDirectAngleSql('1', 'us_east', null)
    expect(sql).toContain('CROSS JOIN LATERAL')
    expect(sql).toContain("-> 'slicePrescription' -> 'sliceGroups'")
    expect(sql).toContain("'scoreVariables' ->> 'angleOff'")
    expect(sql).toContain("'angle' ->> 'ignore'")
  })

  it('synthesizes a slice-group from CT slicePrescriptionScore', () => {
    const sql = getDirectAngleSql('1', 'us_east', null)
    expect(sql).toContain("-> 'slicePrescriptionScore'")
    expect(sql).toContain('jsonb_build_array')
    expect(sql).toContain('jsonb_build_object')
  })

  it('emits MR-only legacy fallback branch (UNION ALL with outer GSV)', () => {
    const sql = getDirectAngleSql('1', 'us_east', null)
    expect(sql).toContain('UNION ALL')
    expect(sql).toContain('jsonb_build_array')
    expect(sql).toContain('sqr."sliceQuantScores" IS NULL')
  })

  it('omits legacy fallback branch in CT mode', () => {
    process.env.APP_MODALITY = 'CT'
    try {
      const sql = getDirectAngleSql('1', 'us_east', null)
      expect(sql).not.toContain('UNION ALL')
    } finally {
      delete process.env.APP_MODALITY
    }
  })

  it('escapes single quotes in body part names', () => {
    const sql = getDirectAngleSql('1', 'us_east', ["Knee's"])
    expect(sql).toContain("'Knee''s'")
  })
})

describe('getDirectWastedSlicesSql', () => {
  it('uses public schema for us_east region', () => {
    const sql = getDirectWastedSlicesSql('123', 'us_east', null)
    expect(sql).toContain('"StackQuestionResults" sqr')
    expect(sql).toContain('"QuestionSetResults" qsr')
    expect(sql).toContain('"TestRuns" tr')
    expect(sql).not.toContain('eu_west_server_public')
    expect(sql).toContain('qsr."userId" = 123')
  })

  it('uses eu_west schema prefix for eu_west region', () => {
    const sql = getDirectWastedSlicesSql('456', 'eu_west', null)
    expect(sql).toContain('"eu_west_server_public"."StackQuestionResults" sqr')
    expect(sql).toContain('"eu_west_server_public"."QuestionSetResults" qsr')
    expect(sql).toContain('"eu_west_server_public"."TestRuns" tr')
  })

  it('includes body part filter when bodyParts provided', () => {
    const sql = getDirectWastedSlicesSql('123', 'us_east', ['Knee'])
    expect(sql).toContain(`bp."name" IN ('Knee')`)
  })

  it('omits body part filter when bodyParts is null', () => {
    expect(getDirectWastedSlicesSql('123', 'us_east', null)).not.toContain('bp."name" IN')
  })

  it('sanitizes userId via parseInt', () => {
    const sql = getDirectWastedSlicesSql('123; DROP TABLE users', 'us_east', null)
    expect(sql).toContain('qsr."userId" = 123')
    expect(sql).not.toContain('DROP TABLE')
  })

  it('throws for non-numeric userId', () => {
    expect(() => getDirectWastedSlicesSql('abc', 'us_east', null)).toThrow('Invalid userId')
  })

  it('expands sliceQuantScores.slicePrescription.sliceGroups via LATERAL and reads coverage fields', () => {
    const sql = getDirectWastedSlicesSql('1', 'us_east', null)
    expect(sql).toContain('CROSS JOIN LATERAL')
    expect(sql).toContain("-> 'slicePrescription' -> 'sliceGroups'")
    expect(sql).toContain("'scoreVariables' ->> 'coverageZTooLow'")
    expect(sql).toContain("'scoreVariables' ->> 'coverageZTooHigh'")
    expect(sql).toContain("'coverageZ' ->> 'ignore'")
  })

  it('synthesizes a slice-group from CT slicePrescriptionScore', () => {
    const sql = getDirectWastedSlicesSql('1', 'us_east', null)
    expect(sql).toContain("-> 'slicePrescriptionScore'")
    expect(sql).toContain('jsonb_build_array')
    expect(sql).toContain('jsonb_build_object')
  })

  it('extracts answer spacing and thickness as scalars', () => {
    const sql = getDirectWastedSlicesSql('1', 'us_east', null)
    expect(sql).toContain("'spacing'")
    expect(sql).toContain("'thickness'")
    expect(sql).toContain('"answerSpacing"')
    expect(sql).toContain('"answerThickness"')
  })

  it('emits MR-only legacy fallback branch (UNION ALL with outer GSV)', () => {
    const sql = getDirectWastedSlicesSql('1', 'us_east', null)
    expect(sql).toContain('UNION ALL')
    expect(sql).toContain('sqr."sliceQuantScores" IS NULL')
  })

  it('omits legacy fallback branch in CT mode', () => {
    process.env.APP_MODALITY = 'CT'
    try {
      const sql = getDirectWastedSlicesSql('1', 'us_east', null)
      expect(sql).not.toContain('UNION ALL')
    } finally {
      delete process.env.APP_MODALITY
    }
  })
})
