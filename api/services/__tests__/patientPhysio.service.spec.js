// ── Mocks ──────────────────────────────────────────────────────

jest.mock('../../../db/models', () => ({
  PatientPhysio: {
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  PatientPhysioCardiacLevel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((cb) => cb({})),
  },
}))
jest.mock('../../../util/constants', () => ({
  CARDIAC_LEVEL: { INITIAL: 'INITIAL' },
}))

const { PatientPhysio } = require('../../../db/models')
const PatientPhysioService = require('../patientPhysio.service')

// ── Tests ──────────────────────────────────────────────────────

describe('patientPhysio.service – deletePatientPhysio', () => {
  it('should await set.destroy() so the row is deleted before returning', async () => {
    const destroyMock = jest.fn().mockResolvedValue()
    PatientPhysio.findOne.mockResolvedValue({ id: 1, destroy: destroyMock })

    const result = await PatientPhysioService.deletePatientPhysio(1)

    expect(destroyMock).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  it('should propagate destroy() errors when awaited', async () => {
    const destroyMock = jest.fn().mockRejectedValue(new Error('destroy failed'))
    PatientPhysio.findOne.mockResolvedValue({ id: 1, destroy: destroyMock })

    await expect(PatientPhysioService.deletePatientPhysio(1)).rejects.toThrow('destroy failed')
  })

  it('should throw 400 when PatientPhysio not found', async () => {
    PatientPhysio.findOne.mockResolvedValue(null)

    await expect(PatientPhysioService.deletePatientPhysio(999)).rejects.toEqual({
      status: 400,
      message: 'PatientPhysio not found',
    })
  })
})

describe('patientPhysio.service – getPatientPhysioByIdWithInitialLevel', () => {
  const makeProfile = (cardiacLevels) => ({
    id: 7,
    toJSON() {
      return { id: 7, name: 'Jane', cardiacLevels }
    },
  })

  it('returns the profile with the INITIAL cardiac level attached', async () => {
    const cardiacLevels = [
      { id: 1, levelType: 'INITIAL', cardiacCycleDuration: 800 },
      { id: 2, levelType: 'OTHER', cardiacCycleDuration: 600 },
    ]
    PatientPhysio.findOne.mockResolvedValue(makeProfile(cardiacLevels))

    const result = await PatientPhysioService.getPatientPhysioByIdWithInitialLevel(7)

    expect(result.id).toBe(7)
    expect(result.cardiacLevel).toEqual(cardiacLevels[0])
  })

  it('falls back to a random cardiac level when no INITIAL is present', async () => {
    const cardiacLevels = [{ id: 2, levelType: 'OTHER' }]
    PatientPhysio.findOne.mockResolvedValue(makeProfile(cardiacLevels))

    const result = await PatientPhysioService.getPatientPhysioByIdWithInitialLevel(7)

    expect(result.cardiacLevel).toEqual(cardiacLevels[0])
  })

  it('throws 400 when the profile does not exist', async () => {
    PatientPhysio.findOne.mockResolvedValue(null)

    await expect(PatientPhysioService.getPatientPhysioByIdWithInitialLevel(999)).rejects.toEqual({
      status: 400,
      message: 'PatientPhysio not found',
    })
  })
})
