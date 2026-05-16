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
    it('groups clinical and didactic rules into the bucketed shape', async () => {
      prisma.interventionRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          domain: 'clinical',
          skillId: 'skill-a',
          categoryId: null,
          level: null,
          fromScore: 0,
          toScore: 50,
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
          fromScore: 60,
          toScore: 80,
          interventions: [{ id: 'i2', text: 'study' }],
          createdAt: new Date('2026-01-02T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        },
      ])

      const result = await service.listAllBucketed()

      expect(result.clinical['skill-a']).toHaveLength(1)
      expect(result.clinical['skill-a'][0].from).toBe(0)
      expect(result.clinical['skill-a'][0].to).toBe(50)
      expect(result.didactic['7'].level3).toHaveLength(1)
      expect(result.didactic['7'].level3[0].categoryId).toBe(7)
    })

    it('returns empty buckets when no rules exist', async () => {
      prisma.interventionRule.findMany.mockResolvedValue([])
      const result = await service.listAllBucketed()
      expect(result).toEqual({ clinical: {}, didactic: {} })
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

    it('coerces string from/to to integers', async () => {
      prisma.interventionRule.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'x', ...data, createdAt: new Date(), updatedAt: new Date() })
      )

      await service.create({
        body: { domain: 'clinical', skillId: 's', from: '0', to: '10', interventions: [{ text: 'x' }] },
        userId: 1,
      })

      const args = prisma.interventionRule.create.mock.calls[0][0]
      expect(args.data.fromScore).toBe(0)
      expect(args.data.toScore).toBe(10)
    })

    it('rejects non-integer-like string scores', async () => {
      await expect(
        service.create({
          body: {
            domain: 'clinical',
            skillId: 's',
            from: '10.5',
            to: '20',
            interventions: [{ text: 'x' }],
          },
          userId: 1,
        })
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects out-of-range scores', async () => {
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
      fromScore: 0,
      toScore: 50,
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
      expect(args.data.fromScore).toBe(10)
      expect(args.data.toScore).toBe(60)
      expect(args.data.interventions).toHaveLength(2)
      expect(args.data.interventions[0]).toEqual({ id: OLD_1, text: 'a-edited' })
      expect(args.data.interventions[1].id).toMatch(UUID_RE)
      expect(args.data.interventions[1].text).toBe('new one')
      expect(args.data.interventions.find((i) => i.id === OLD_2)).toBeUndefined()
      expect(result.id).toBe(RULE_ID)
    })

    it('coerces string from/to to integers', async () => {
      prisma.interventionRule.findUnique.mockResolvedValue(existing)
      prisma.interventionRule.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existing, ...data, updatedAt: new Date() })
      )

      await service.update({
        id: RULE_ID,
        body: { from: '10', to: '60', interventions: [{ id: OLD_1, text: 'a' }] },
      })

      const args = prisma.interventionRule.update.mock.calls[0][0]
      expect(args.data.fromScore).toBe(10)
      expect(args.data.toScore).toBe(60)
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
      const didactic = { ...existing, domain: 'didactic', skillId: null, categoryId: 3, level: 'overall' }
      prisma.interventionRule.findUnique.mockResolvedValue(didactic)
      await expect(
        service.update({
          id: didactic.id,
          body: { from: 0, to: 50, interventions: [{ id: OLD_1, text: 'a' }] },
        })
      ).rejects.toMatchObject({ status: 400 })
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
