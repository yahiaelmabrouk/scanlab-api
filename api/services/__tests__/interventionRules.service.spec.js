jest.mock('../../../db/prisma', () => ({
  interventionRule: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

const prisma = require('../../../db/prisma')
const service = require('../interventionRules.service')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

beforeEach(() => {
  jest.clearAllMocks()
})

describe('InterventionRulesService', () => {
  describe('#listAllBucketed', () => {
    it('groups clinical, didactic, and consistency rules into the bucketed shape', async () => {
      prisma.interventionRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          domain: 'clinical',
          skillId: 'skill-a',
          categoryId: null,
          level: null,
          metric: null,
          aggregation: null,
          scope: null,
          fromValue: 0,
          toValue: 50,
          interventions: [{ id: 'i1', text: 'review' }],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'r2',
          domain: 'didactic',
          skillId: null,
          categoryId: 7,
          level: 'level3',
          metric: null,
          aggregation: null,
          scope: null,
          fromValue: 60,
          toValue: 80,
          interventions: [{ id: 'i2', text: 'study' }],
          createdAt: new Date('2026-01-02T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        },
        {
          id: 'r3',
          domain: 'consistency',
          skillId: null,
          categoryId: null,
          level: null,
          metric: 'angulation',
          aggregation: null,
          scope: 'perExam',
          fromValue: 0,
          toValue: 5,
          interventions: [{ id: 'i3', text: 'check angle' }],
          createdAt: new Date('2026-01-03T00:00:00Z'),
          updatedAt: new Date('2026-01-03T00:00:00Z'),
        },
        {
          id: 'r4',
          domain: 'consistency',
          skillId: null,
          categoryId: null,
          level: null,
          metric: 'wastedSlices',
          aggregation: 'absoluteTotal',
          scope: 'perQuestion',
          fromValue: 0,
          toValue: 20,
          interventions: [{ id: 'i4', text: 'reduce slices' }],
          createdAt: new Date('2026-01-04T00:00:00Z'),
          updatedAt: new Date('2026-01-04T00:00:00Z'),
        },
      ])

      const result = await service.listAllBucketed()

      expect(result.clinical['skill-a']).toHaveLength(1)
      expect(result.clinical['skill-a'][0].from).toBe(0)
      expect(result.clinical['skill-a'][0].to).toBe(50)
      expect(result.didactic['7'].level3).toHaveLength(1)
      expect(result.didactic['7'].level3[0].categoryId).toBe(7)
      expect(result.consistency.angulation).toHaveLength(1)
      expect(result.consistency.angulation[0].metric).toBe('angulation')
      expect(result.consistency.angulation[0].aggregation).toBeNull()
      expect(result.consistency.angulation[0].scope).toBe('perExam')
      expect(result.clinical['skill-a'][0].scope).toBeNull()
      expect(result.didactic['7'].level3[0].scope).toBeNull()
      expect(result.consistency.wastedSlices).toHaveLength(1)
      expect(result.consistency.wastedSlices[0].aggregation).toBe('absoluteTotal')
      expect(result.consistency.wastedSlices[0].scope).toBe('perQuestion')
    })

    it('returns empty buckets when no rules exist', async () => {
      prisma.interventionRule.findMany.mockResolvedValue([])
      const result = await service.listAllBucketed()
      expect(result).toEqual({ clinical: {}, didactic: {}, consistency: {} })
    })

    it('casts Decimal-like fromValue/toValue to native numbers', async () => {
      const decimalLike = (v) => ({ toNumber: () => v })
      prisma.interventionRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          domain: 'consistency',
          skillId: null,
          categoryId: null,
          level: null,
          metric: 'angulation',
          aggregation: null,
          fromValue: decimalLike(0.5),
          toValue: decimalLike(2.5),
          interventions: [{ id: 'i1', text: 'x' }],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ])
      const result = await service.listAllBucketed()
      const rule = result.consistency.angulation[0]
      expect(rule.from).toBe(0.5)
      expect(rule.to).toBe(2.5)
    })

    it('casts string-encoded Decimal fromValue/toValue to native numbers', async () => {
      prisma.interventionRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          domain: 'consistency',
          skillId: null,
          categoryId: null,
          level: null,
          metric: 'angulation',
          aggregation: null,
          scope: 'perExam',
          fromValue: '0.500',
          toValue: '2.750',
          interventions: [{ id: 'i1', text: 'x' }],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ])
      const result = await service.listAllBucketed()
      const rule = result.consistency.angulation[0]
      expect(rule.from).toBe(0.5)
      expect(rule.to).toBe(2.75)
    })
  })

  describe('#create', () => {
    it('creates a clinical rule and assigns intervention uuids', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'new-id',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      )

      const result = await service.create({
        body: {
          domain: 'clinical',
          skillId: 'skill-x',
          from: 10,
          to: 20,
          interventions: [{ text: 'do this' }, { text: 'do that' }],
        },
        userId: 42,
      })

      expect(prisma.interventionRule.create).toHaveBeenCalledTimes(1)
      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.createdBy).toBe(42)
      expect(args.data.domain).toBe('clinical')
      expect(args.data.skillId).toBe('skill-x')
      expect(args.data.categoryId).toBeNull()
      expect(args.data.level).toBeNull()
      expect(args.data.metric).toBeNull()
      expect(args.data.aggregation).toBeNull()
      expect(args.data.interventions).toHaveLength(2)
      expect(args.data.interventions[0].id).toMatch(UUID_RE)
      expect(result.from).toBe(10)
    })

    it('creates a didactic rule', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'd-id', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: {
          domain: 'didactic',
          categoryId: 5,
          level: 'overall',
          from: 0,
          to: 100,
          interventions: [{ text: 'study chapter 3' }],
        },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.skillId).toBeNull()
      expect(args.data.categoryId).toBe(5)
      expect(args.data.level).toBe('overall')
      expect(args.data.metric).toBeNull()
      expect(args.data.aggregation).toBeNull()
    })

    it('creates a consistency angulation rule (no aggregation)', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c-id', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      const result = await service.create({
        body: {
          domain: 'consistency',
          metric: 'angulation',
          scope: 'perExam',
          from: 0.5,
          to: 5,
          interventions: [{ text: 'review angle' }],
        },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.domain).toBe('consistency')
      expect(args.data.metric).toBe('angulation')
      expect(args.data.aggregation).toBeNull()
      expect(args.data.scope).toBe('perExam')
      expect(args.data.skillId).toBeNull()
      expect(args.data.categoryId).toBeNull()
      expect(args.data.level).toBeNull()
      expect(args.data.fromValue).toBe(0.5)
      expect(args.data.toValue).toBe(5)
      expect(result.metric).toBe('angulation')
      expect(result.scope).toBe('perExam')
    })

    it('creates a consistency wastedSlices rule with aggregation', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c-id', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: {
          domain: 'consistency',
          metric: 'wastedSlices',
          aggregation: 'absoluteTotal',
          scope: 'perQuestion',
          from: 0,
          to: 20,
          interventions: [{ text: 'reduce slices' }],
        },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.metric).toBe('wastedSlices')
      expect(args.data.aggregation).toBe('absoluteTotal')
      expect(args.data.scope).toBe('perQuestion')
    })

    it('creates a consistency wastedCoverage rule with negative range when aggregation=total', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c-id', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: {
          domain: 'consistency',
          metric: 'wastedCoverage',
          aggregation: 'total',
          scope: 'perExam',
          from: -10,
          to: 10,
          interventions: [{ text: 'recenter coverage' }],
        },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.fromValue).toBe(-10)
      expect(args.data.toValue).toBe(10)
    })

    it('rejects negative `from` for wastedSlices aggregation=absoluteTotal', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'wastedSlices',
            aggregation: 'absoluteTotal',
            scope: 'perQuestion',
            from: -1,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects negative `from` for angulation', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            scope: 'perExam',
            from: -1,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects aggregation on consistency angulation create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            aggregation: 'absoluteTotal',
            scope: 'perExam',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects explicit aggregation=null on consistency angulation create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            aggregation: null,
            scope: 'perExam',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({
        status: 400,
        message: '`aggregation` is not allowed for `angulation`',
      })
    })

    it('rejects missing aggregation on wastedSlices create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'wastedSlices',
            scope: 'perQuestion',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects unknown metric on consistency create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'bogus',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects skillId/categoryId/level on consistency create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            scope: 'perExam',
            skillId: 's',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects consistency angulation create without scope', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects consistency wastedSlices create without scope', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'wastedSlices',
            aggregation: 'absoluteTotal',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects consistency create with invalid scope', async () => {
      await expect(
        service.create({
          body: {
            domain: 'consistency',
            metric: 'angulation',
            scope: 'overall',
            from: 0,
            to: 5,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects scope on clinical create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            scope: 'perExam',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects scope on didactic create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'didactic',
            categoryId: 1,
            level: 'overall',
            scope: 'perExam',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('persists scope=null for clinical/didactic and the provided scope for consistency', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'x', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: { domain: 'clinical', skillId: 's', from: 0, to: 10, interventions: [{ text: 'x' }] },
        userId: 1,
      })
      expect(prisma.interventionRule.create.mock.calls[0][0].data.scope).toBeNull()

      await service.create({
        body: {
          domain: 'didactic',
          categoryId: 5,
          level: 'overall',
          from: 0,
          to: 100,
          interventions: [{ text: 'x' }],
        },
        userId: 1,
      })
      expect(prisma.interventionRule.create.mock.calls[1][0].data.scope).toBeNull()

      await service.create({
        body: {
          domain: 'consistency',
          metric: 'angulation',
          scope: 'perExam',
          from: 0,
          to: 5,
          interventions: [{ text: 'x' }],
        },
        userId: 1,
      })
      expect(prisma.interventionRule.create.mock.calls[2][0].data.scope).toBe('perExam')
    })

    it('rejects metric/aggregation on clinical create', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            metric: 'angulation',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects clinical rule with missing skillId', async () => {
      await expect(
        service.create({
          body: { domain: 'clinical', from: 0, to: 10, interventions: [{ text: 'x' }] },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects didactic rule with bad level', async () => {
      await expect(
        service.create({
          body: {
            domain: 'didactic',
            categoryId: 1,
            level: 'level9',
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects from > to', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: 50,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects intervention text longer than 1000 characters', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: 0,
            to: 10,
            interventions: [{ text: 'a'.repeat(1001) }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects more than 100 interventions', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) => ({ text: `t${i}` }))
      await expect(
        service.create({
          body: { domain: 'clinical', skillId: 's', from: 0, to: 10, interventions: tooMany },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects empty interventions', async () => {
      await expect(
        service.create({
          body: { domain: 'clinical', skillId: 's', from: 0, to: 10, interventions: [] },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects intervention with empty text', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: 0,
            to: 10,
            interventions: [{ text: '   ' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects categoryId on clinical rule', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            categoryId: 1,
            from: 0,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('coerces string from/to to numbers', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'x', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: { domain: 'clinical', skillId: 's', from: '0', to: '10', interventions: [{ text: 'x' }] },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.fromValue).toBe(0)
      expect(args.data.toValue).toBe(10)
    })

    it('accepts decimal from/to for consistency angulation', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'x', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: {
          domain: 'consistency',
          metric: 'angulation',
          scope: 'perExam',
          from: '0.5',
          to: '2.75',
          interventions: [{ text: 'x' }],
        },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.fromValue).toBe(0.5)
      expect(args.data.toValue).toBe(2.75)
    })

    it('rejects garbage string scores', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: 'abc',
            to: '20',
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects out-of-range scores for clinical', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: -1,
            to: 10,
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('#update', () => {
    const RULE_ID = '11111111-1111-1111-1111-111111111111'
    const OLD_1 = '22222222-2222-2222-2222-222222222222'
    const OLD_2 = '33333333-3333-3333-3333-333333333333'
    const existing = {
      id: RULE_ID,
      domain: 'clinical',
      skillId: 'skill-a',
      categoryId: null,
      level: null,
      metric: null,
      aggregation: null,
      fromValue: 0,
      toValue: 50,
      interventions: [
        { id: OLD_1, text: 'a' },
        { id: OLD_2, text: 'b' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('reconciles interventions: keep, edit, add, drop', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data, updatedAt: new Date() })
      )

      const result = await service.update({
        id: RULE_ID,
        body: {
          from: 10,
          to: 60,
          interventions: [{ id: OLD_1, text: 'a-edited' }, { text: 'new one' }],
        },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.where).toEqual({ id: RULE_ID })
      expect(args.data.fromValue).toBe(10)
      expect(args.data.toValue).toBe(60)
      expect(args.data.interventions).toHaveLength(2)
      expect(args.data.interventions[0]).toEqual({ id: OLD_1, text: 'a-edited' })
      expect(args.data.interventions[1].id).toMatch(UUID_RE)
      expect(args.data.interventions[1].text).toBe('new one')
      expect(args.data.interventions.find((i) => i.id === OLD_2)).toBeUndefined()
      expect(result.id).toBe(RULE_ID)
    })

    it('coerces string from/to to numbers', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data, updatedAt: new Date() })
      )

      await service.update({
        id: RULE_ID,
        body: { from: '10', to: '60', interventions: [{ id: OLD_1, text: 'a' }] },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.fromValue).toBe(10)
      expect(args.data.toValue).toBe(60)
    })

    it('ignores `level` on clinical updates instead of rejecting', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data, updatedAt: new Date() })
      )

      await service.update({
        id: RULE_ID,
        body: {
          from: 0,
          to: 50,
          level: 'overall',
          interventions: [{ id: OLD_1, text: 'a' }],
        },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.level).toBeUndefined()
    })

    it('returns 404 for malformed (non-uuid) rule id', async () => {
      await expect(
        service.update({
          id: 'not-a-uuid',
          body: { from: 0, to: 50, interventions: [{ text: 'x' }] },
        })
      ).rejects.toMatchObject({ status: 404 })
      expect(prisma.interventionRule.findUnique).not.toHaveBeenCalled()
    })

    it('rejects unknown intervention id', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            from: 0,
            to: 50,
            interventions: [{ id: '99999999-9999-9999-9999-999999999999', text: 'x' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects mutation of immutable domain', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            domain: 'didactic',
            from: 0,
            to: 50,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects mutation of immutable skillId', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            skillId: 'other',
            from: 0,
            to: 50,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects mutation of immutable metric', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            metric: 'wastedSlices',
            from: 0,
            to: 5,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects mutation of immutable scope (matching value)', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
        scope: 'perExam',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            scope: 'perExam',
            from: 0,
            to: 5,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400, message: '`scope` is immutable and cannot be updated' })
    })

    it('rejects mutation of immutable scope (different value)', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
        scope: 'perExam',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            scope: 'perQuestion',
            from: 0,
            to: 5,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400, message: '`scope` is immutable and cannot be updated' })
    })

    it('omits scope from the Prisma update payload when not present in body', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
        scope: 'perExam',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...consistency, ...data, updatedAt: new Date() })
      )

      await service.update({
        id: RULE_ID,
        body: { from: 0, to: 5, interventions: [{ id: OLD_1, text: 'a' }] },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.scope).toBeUndefined()
    })

    it('returns 404 when rule not found', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(null)
      await expect(
        service.update({
          id: '44444444-4444-4444-4444-444444444444',
          body: { from: 0, to: 50, interventions: [{ text: 'x' }] },
        })
      ).rejects.toMatchObject({ status: 404 })
    })

    it('requires valid level on didactic update', async () => {
      const didactic = {
        ...existing,
        domain: 'didactic',
        skillId: null,
        categoryId: 3,
        level: 'overall',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(didactic)
      await expect(
        service.update({
          id: didactic.id,
          body: { from: 0, to: 50, interventions: [{ id: OLD_1, text: 'a' }] },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('requires valid aggregation on wastedSlices update', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'wastedSlices',
        aggregation: 'absoluteTotal',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            from: 0,
            to: 10,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('persists aggregation on wastedSlices update and applies new range rules', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'wastedSlices',
        aggregation: 'absoluteTotal',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...consistency, ...data, updatedAt: new Date() })
      )

      // switching aggregation to 'total' allows negatives
      await service.update({
        id: RULE_ID,
        body: {
          from: -5,
          to: 5,
          aggregation: 'total',
          interventions: [{ id: OLD_1, text: 'a' }],
        },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.aggregation).toBe('total')
      expect(args.data.fromValue).toBe(-5)
      expect(args.data.toValue).toBe(5)
    })

    it('rejects aggregation on angulation PUT', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            from: 0,
            to: 5,
            aggregation: 'absoluteTotal',
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('ignores `level` on consistency PUT', async () => {
      const consistency = {
        ...existing,
        domain: 'consistency',
        skillId: null,
        metric: 'angulation',
        aggregation: null,
      }
      prisma.interventionRule.findUnique.mockResolvedValue(consistency)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...consistency, ...data, updatedAt: new Date() })
      )

      await service.update({
        id: RULE_ID,
        body: {
          from: 0,
          to: 5,
          level: 'overall',
          interventions: [{ id: OLD_1, text: 'a' }],
        },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.level).toBeUndefined()
    })

    it('rejects missing `from` on PUT', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: { to: 50, interventions: [{ id: OLD_1, text: 'a' }] },
        })
      ).rejects.toMatchObject({ status: 400, message: '`from` must be a number' })
    })

    it('rejects missing `to` on PUT', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: { from: 0, interventions: [{ id: OLD_1, text: 'a' }] },
        })
      ).rejects.toMatchObject({ status: 400, message: '`to` must be a number' })
    })

    it('rejects scope on clinical PUT', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            scope: 'perExam',
            from: 0,
            to: 50,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: '`scope` is immutable and cannot be updated',
      })
    })

    it('rejects scope on didactic PUT', async () => {
      const didactic = {
        ...existing,
        domain: 'didactic',
        skillId: null,
        categoryId: 3,
        level: 'overall',
      }
      prisma.interventionRule.findUnique.mockResolvedValue(didactic)
      await expect(
        service.update({
          id: RULE_ID,
          body: {
            scope: 'perExam',
            level: 'overall',
            from: 0,
            to: 50,
            interventions: [{ id: OLD_1, text: 'a' }],
          },
        })
      ).rejects.toMatchObject({
        status: 400,
        message: '`scope` is immutable and cannot be updated',
      })
    })
  })

  describe('#remove', () => {
    const VALID_ID = '55555555-5555-5555-5555-555555555555'

    it('deletes successfully', async () => {
      prisma.interventionRule.delete.mockResolvedValue({})
      await service.remove(VALID_ID)
      expect(prisma.interventionRule.delete).toHaveBeenCalledWith({ where: { id: VALID_ID } })
    })

    it('returns 404 for malformed (non-uuid) id', async () => {
      await expect(service.remove('nope')).rejects.toMatchObject({ status: 404 })
      expect(prisma.interventionRule.delete).not.toHaveBeenCalled()
    })

    it('maps P2025 to 404', async () => {
      const err = new Error('not found')
      err.code = 'P2025'
      prisma.interventionRule.delete.mockRejectedValue(err)
      await expect(service.remove(VALID_ID)).rejects.toMatchObject({ status: 404 })
    })
  })
})
