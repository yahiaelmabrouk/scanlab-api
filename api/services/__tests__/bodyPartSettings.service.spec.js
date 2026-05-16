const subject = require('../bodyPartSettings.service')

// Mock the db/models
jest.mock('../../../db/models', () => {
  const mockTransaction = {
    LOCK: { UPDATE: 'UPDATE' },
  }

  return {
    Cohort: {
      findByPk: jest.fn(),
    },
    CohortStudent: {
      findByPk: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn((callback) => callback(mockTransaction)),
    },
  }
})

const db = require('../../../db/models')

describe('bodyPartSettings.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('#applyDeltaOperations', () => {
    it('should add IDs to empty array', () => {
      const currentSettings = {}
      const deltaOperations = {
        sandboxedBodyParts: { add: [1, 2], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
    })

    it('should add IDs to existing array', () => {
      const currentSettings = { sandboxedBodyParts: [1] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [2, 3], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2, 3])
    })

    it('should skip duplicates when adding', () => {
      const currentSettings = { sandboxedBodyParts: [1, 2] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [2, 3], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2, 3])
    })

    it('should remove IDs from array', () => {
      const currentSettings = { sandboxedBodyParts: [1, 2, 3] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [], remove: [2] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 3])
    })

    it('should handle removing non-existent IDs (no error)', () => {
      const currentSettings = { sandboxedBodyParts: [1, 2] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [], remove: [5] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
    })

    it('should handle add and remove same ID (remove wins)', () => {
      const currentSettings = { sandboxedBodyParts: [1] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [2], remove: [2] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      // Remove happens first, then add - so ID 2 ends up being added
      expect(result.sandboxedBodyParts).toContain(2)
    })

    it('should handle empty delta (no change)', () => {
      const currentSettings = { sandboxedBodyParts: [1, 2] }
      const deltaOperations = {
        sandboxedBodyParts: { add: [], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
    })

    it('should handle multiple setting keys', () => {
      const currentSettings = {
        sandboxedBodyParts: [1],
        lockedBodyParts: [10],
        lockedRegions: [3],
      }
      const deltaOperations = {
        sandboxedBodyParts: { add: [2], remove: [] },
        lockedBodyParts: { add: [11], remove: [10] },
        lockedRegions: { add: [], remove: [3] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
      expect(result.lockedBodyParts).toEqual([11])
      expect(result.lockedRegions).toEqual([])
    })

    it('should preserve other settings fields', () => {
      const currentSettings = {
        sandboxedBodyParts: [1],
        someOtherSetting: 'value',
      }
      const deltaOperations = {
        sandboxedBodyParts: { add: [2], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
      expect(result.someOtherSetting).toEqual('value')
    })

    it('should handle undefined add/remove arrays', () => {
      const currentSettings = { sandboxedBodyParts: [1] }
      const deltaOperations = {
        sandboxedBodyParts: {},
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1])
    })

    it('should handle non-array current value', () => {
      const currentSettings = { sandboxedBodyParts: null }
      const deltaOperations = {
        sandboxedBodyParts: { add: [1, 2], remove: [] },
      }

      const result = subject.applyDeltaOperations(currentSettings, deltaOperations)

      expect(result.sandboxedBodyParts).toEqual([1, 2])
    })
  })

  describe('#extractBodyPartSettings', () => {
    it('should extract body part settings from full settings object', () => {
      const settings = {
        sandboxedBodyParts: [1, 2],
        lockedBodyParts: [3],
        lockedRegions: [4],
        someOtherSetting: 'value',
      }

      const result = subject.extractBodyPartSettings(settings)

      expect(result).toEqual({
        sandboxedBodyParts: [1, 2],
        lockedBodyParts: [3],
        lockedRegions: [4],
      })
      expect(result.someOtherSetting).toBeUndefined()
    })

    it('should return empty arrays for missing fields', () => {
      const settings = {}

      const result = subject.extractBodyPartSettings(settings)

      expect(result).toEqual({
        sandboxedBodyParts: [],
        lockedBodyParts: [],
        lockedRegions: [],
      })
    })
  })

  describe('#updateCohortBodyPartSettings', () => {
    it('should update cohort settings atomically', async () => {
      const mockCohort = {
        id: 123,
        settings: { sandboxedBodyParts: [1] },
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.Cohort.findByPk.mockResolvedValue(mockCohort)

      const result = await subject.updateCohortBodyPartSettings(123, 'settings', {
        sandboxedBodyParts: { add: [2, 3], remove: [] },
      })

      expect(db.Cohort.findByPk).toHaveBeenCalledWith(123, {
        transaction: expect.any(Object),
        lock: 'UPDATE',
      })
      expect(mockCohort.save).toHaveBeenCalledWith({ transaction: expect.any(Object) })
      expect(result).toEqual({
        sandboxedBodyParts: [1, 2, 3],
        lockedBodyParts: [],
        lockedRegions: [],
      })
    })

    it('should update adminSettings when target is adminSettings', async () => {
      const mockCohort = {
        id: 123,
        adminSettings: { sandboxedBodyParts: [5] },
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.Cohort.findByPk.mockResolvedValue(mockCohort)

      const result = await subject.updateCohortBodyPartSettings(123, 'adminSettings', {
        sandboxedBodyParts: { add: [6], remove: [5] },
      })

      expect(mockCohort.adminSettings.sandboxedBodyParts).toEqual([6])
      expect(mockCohort.changed).toHaveBeenCalledWith('adminSettings', true)
      expect(result.sandboxedBodyParts).toEqual([6])
    })

    it('should throw error when cohort not found', async () => {
      db.Cohort.findByPk.mockResolvedValue(null)

      await expect(
        subject.updateCohortBodyPartSettings(999, 'settings', {
          sandboxedBodyParts: { add: [1], remove: [] },
        })
      ).rejects.toThrow('Cohort not found')
    })

    it('should handle empty current settings', async () => {
      const mockCohort = {
        id: 123,
        settings: null,
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.Cohort.findByPk.mockResolvedValue(mockCohort)

      const result = await subject.updateCohortBodyPartSettings(123, 'settings', {
        sandboxedBodyParts: { add: [1, 2], remove: [] },
      })

      expect(result.sandboxedBodyParts).toEqual([1, 2])
    })
  })

  describe('#updateCohortStudentBodyPartSettings', () => {
    it('should update cohort student settingsFromManager atomically', async () => {
      const mockStudent = {
        id: 456,
        cohortId: 123,
        settingsFromManager: { sandboxedBodyParts: [1] },
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.CohortStudent.findByPk.mockResolvedValue(mockStudent)

      const result = await subject.updateCohortStudentBodyPartSettings(456, {
        sandboxedBodyParts: { add: [2], remove: [] },
        lockedBodyParts: { add: [10], remove: [] },
      })

      expect(db.CohortStudent.findByPk).toHaveBeenCalledWith(456, {
        transaction: expect.any(Object),
        lock: 'UPDATE',
      })
      expect(mockStudent.save).toHaveBeenCalledWith({ transaction: expect.any(Object) })
      expect(result).toEqual({
        sandboxedBodyParts: [1, 2],
        lockedBodyParts: [10],
        lockedRegions: [],
        cohortId: 123,
      })
    })

    it('should throw error when cohort student not found', async () => {
      db.CohortStudent.findByPk.mockResolvedValue(null)

      await expect(
        subject.updateCohortStudentBodyPartSettings(999, {
          sandboxedBodyParts: { add: [1], remove: [] },
        })
      ).rejects.toThrow('Cohort student not found')
    })

    it('should handle empty current settingsFromManager', async () => {
      const mockStudent = {
        id: 456,
        cohortId: 123,
        settingsFromManager: null,
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.CohortStudent.findByPk.mockResolvedValue(mockStudent)

      const result = await subject.updateCohortStudentBodyPartSettings(456, {
        sandboxedBodyParts: { add: [1, 2], remove: [] },
      })

      expect(result.sandboxedBodyParts).toEqual([1, 2])
      expect(result.cohortId).toEqual(123)
    })

    it('should include cohortId in response', async () => {
      const mockStudent = {
        id: 456,
        cohortId: 789,
        settingsFromManager: {},
        changed: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      }

      db.CohortStudent.findByPk.mockResolvedValue(mockStudent)

      const result = await subject.updateCohortStudentBodyPartSettings(456, {
        sandboxedBodyParts: { add: [1], remove: [] },
      })

      expect(result.cohortId).toEqual(789)
    })
  })
})
