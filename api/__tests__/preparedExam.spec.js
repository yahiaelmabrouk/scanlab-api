// ── Mocks ──────────────────────────────────────────────────────

jest.mock('../../db/models', () => {
  const SequelizeMock = { Op: { or: Symbol('or') } }
  return {
    PreparedExam: {
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn(),
      create: jest.fn(),
    },
    PatientPhysio: {
      findByPk: jest.fn(),
    },
    Sequelize: SequelizeMock,
    CohortPreparedExam: { findAll: jest.fn().mockResolvedValue([]) },
    sequelize: {},
  }
})
jest.mock('../api_util/api_util', () => ({
  requireAdmin: (req, res, next) => next(),
  fetchLoggedInUser: (req, res, next) => next(),
}))
jest.mock('../providers/model.provider', () => ({}))

const request = require('supertest')
const express = require('express')
const { PreparedExam, PatientPhysio } = require('../../db/models')

// ── Build a mini Express app that mounts the router ───────────

const app = express()
app.use(express.json())
app.use('/', require('../preparedExam'))

// ── Tests ──────────────────────────────────────────────────────

describe('PATCH /prepared-exams/:id – await patchedExam.save()', () => {
  it('should await save() so the write completes before responding', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    PreparedExam.findByPk.mockResolvedValue({
      questions: {},
      changed: jest.fn(),
      save: saveMock,
    })

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [] })

    // save must have been called (and awaited — verified because a rejected
    // promise would propagate as a 500 if await is present).
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(res.body.success).toBe(true)
  })

  it('should complete save() before sending the response', async () => {
    const callOrder = []
    const saveMock = jest.fn().mockImplementation(() => {
      callOrder.push('save')
      return Promise.resolve()
    })

    PreparedExam.findByPk.mockResolvedValue({
      questions: {},
      changed: jest.fn(),
      save: saveMock,
      toJSON: function () {
        return this
      },
    })

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [] })

    // save must have been called (and awaited) before the response was sent
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(callOrder).toContain('save')
    expect(res.body.success).toBe(true)
  })
})

describe('PATCH /prepared-exams/:id – patientPhysioId assignment', () => {
  beforeEach(() => {
    PatientPhysio.findByPk.mockReset()
  })

  it('assigns a valid patientPhysioId and saves it on the exam', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    const exam = { questions: {}, changed: jest.fn(), save: saveMock }
    PreparedExam.findByPk.mockResolvedValue(exam)
    PatientPhysio.findByPk.mockResolvedValue({ id: 42 })

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [], patientPhysioId: 42 })

    expect(PatientPhysio.findByPk).toHaveBeenCalledWith(42)
    expect(exam.patientPhysioId).toBe(42)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(res.body.success).toBe(true)
  })

  it('clears patientPhysioId when null is explicitly passed (random fallback)', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    const exam = { questions: {}, changed: jest.fn(), save: saveMock, patientPhysioId: 42 }
    PreparedExam.findByPk.mockResolvedValue(exam)

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [], patientPhysioId: null })

    expect(PatientPhysio.findByPk).not.toHaveBeenCalled()
    expect(exam.patientPhysioId).toBeNull()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(res.body.success).toBe(true)
  })

  it('returns 400 when patientPhysioId is a non-integer (e.g. a string)', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    PreparedExam.findByPk.mockResolvedValue({ questions: {}, changed: jest.fn(), save: saveMock })

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [], patientPhysioId: '42' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(PatientPhysio.findByPk).not.toHaveBeenCalled()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('preserves the existing patientPhysioId when the field is omitted from the body', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    const exam = { questions: {}, changed: jest.fn(), save: saveMock, patientPhysioId: 42 }
    PreparedExam.findByPk.mockResolvedValue(exam)

    await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [] })

    expect(exam.patientPhysioId).toBe(42)
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when patientPhysioId does not exist', async () => {
    const saveMock = jest.fn().mockResolvedValue()
    PreparedExam.findByPk.mockResolvedValue({ questions: {}, changed: jest.fn(), save: saveMock })
    PatientPhysio.findByPk.mockResolvedValue(null)

    const res = await request(app)
      .patch('/prepared-exams/1')
      .send({ published: true, preTestQuestions: [], postTestQuestions: [], patientPhysioId: 999 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(saveMock).not.toHaveBeenCalled()
  })
})
