// ── Mocks ──────────────────────────────────────────────────────

jest.mock('../../../db/models', () => ({
  PreparedExam: { findByPk: jest.fn() },
}))
jest.mock('../../api_util/api_util', () => ({
  fetchLoggedInUser: (req, res, next) => {
    req.session = { userId: 1, user: { id: 1 } }
    next()
  },
  requireAdmin: (req, res, next) => next(),
  getUserInfomationFromUserModel: () => ({}),
}))
jest.mock('../../services/cohorts.service', () => ({
  findAllCohorts: jest.fn().mockResolvedValue([{ id: 1 }]),
}))
jest.mock('../../services/testRun.service', () => ({
  startTestRun: jest.fn().mockResolvedValue({ id: 101 }),
  generatePreparedExamTestQuestions: jest.fn().mockResolvedValue([]),
  generatePreparedExamTestQuestionsDynamically: jest.fn().mockResolvedValue([]),
  generateTestQuestions: jest.fn().mockResolvedValue([]),
  NoQuestionSetAvailableError: class {},
}))
jest.mock('../../services/patientPhysio.service', () => ({
  getRandomPatientPhysio: jest.fn(),
  getPatientPhysioByIdWithInitialLevel: jest.fn(),
}))
jest.mock('../../statsCacheHelper', () => ({}))

const request = require('supertest')
const express = require('express')
const { PreparedExam } = require('../../../db/models')
const patientPhysioSvc = require('../../services/patientPhysio.service')

const app = express()
app.use(express.json())
app.use('/', require('../testRun.controller'))

describe('POST /tests/start – patientPhysio resolution', () => {
  beforeEach(() => {
    PreparedExam.findByPk.mockReset()
    patientPhysioSvc.getRandomPatientPhysio.mockReset()
    patientPhysioSvc.getPatientPhysioByIdWithInitialLevel.mockReset()
  })

  it('returns the assigned patient physio when preparedExam has patientPhysioId', async () => {
    PreparedExam.findByPk.mockResolvedValue({ id: 10, patientPhysioId: 42 })
    patientPhysioSvc.getPatientPhysioByIdWithInitialLevel.mockResolvedValue({ id: 42, name: 'Assigned' })

    const res = await request(app)
      .post('/tests/start')
      .send({ preparedExam: { id: 10, isDynamic: false } })

    expect(patientPhysioSvc.getPatientPhysioByIdWithInitialLevel).toHaveBeenCalledWith(42)
    expect(patientPhysioSvc.getRandomPatientPhysio).not.toHaveBeenCalled()
    expect(res.body.patientPhysio).toEqual({ id: 42, name: 'Assigned' })
  })

  it('falls back to a random patient physio when preparedExam has no patientPhysioId', async () => {
    PreparedExam.findByPk.mockResolvedValue({ id: 10, patientPhysioId: null })
    patientPhysioSvc.getRandomPatientPhysio.mockResolvedValue({ id: 7, name: 'Random' })

    const res = await request(app)
      .post('/tests/start')
      .send({ preparedExam: { id: 10, isDynamic: false } })

    expect(patientPhysioSvc.getRandomPatientPhysio).toHaveBeenCalledTimes(1)
    expect(patientPhysioSvc.getPatientPhysioByIdWithInitialLevel).not.toHaveBeenCalled()
    expect(res.body.patientPhysio).toEqual({ id: 7, name: 'Random' })
  })

  it('returns patientPhysio=null when the assigned bio lookup fails (orphaned FK)', async () => {
    PreparedExam.findByPk.mockResolvedValue({ id: 10, patientPhysioId: 42 })
    patientPhysioSvc.getPatientPhysioByIdWithInitialLevel.mockRejectedValue({
      status: 400,
      message: 'PatientPhysio not found',
    })

    const res = await request(app)
      .post('/tests/start')
      .send({ preparedExam: { id: 10, isDynamic: false } })

    expect(res.body.success).toBe(true)
    expect(res.body.patientPhysio).toBeNull()
  })

  it('returns patientPhysio=null when the PreparedExam row cannot be found', async () => {
    PreparedExam.findByPk.mockResolvedValue(null)
    patientPhysioSvc.getRandomPatientPhysio.mockRejectedValue(new Error('no physios'))

    const res = await request(app)
      .post('/tests/start')
      .send({ preparedExam: { id: 10, isDynamic: false } })

    expect(res.body.success).toBe(true)
    expect(res.body.patientPhysio).toBeNull()
  })
})
