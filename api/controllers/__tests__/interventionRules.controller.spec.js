// ── Mocks ──────────────────────────────────────────────────────
const adminState = { isAdmin: true, isCohortManager: false }

jest.mock('../../api_util/api_util', () => ({
  fetchLoggedInUser: (req, res, next) => {
    if (req.headers['x-no-auth']) return res.status(401).send('Not logged in!')
    req.session = { userId: 1, user: { id: 1 } }
    next()
  },
  requireAdmin: (req, res, next) => {
    if (!adminState.isAdmin) {
      return res.status(401).json({ success: false, error: 'You must be an authorized admin' })
    }
    next()
  },
  requireAdminOrCohortManager: (req, res, next) => {
    if (adminState.isAdmin || adminState.isCohortManager) return next()
    return res.status(403).json({ success: false, error: 'Forbidden' })
  },
}))

jest.mock('../../services/interventionRules.service', () => ({
  listAllBucketed: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const svc = require('../../services/interventionRules.service')

const app = express()
app.use(express.json())
app.use('/', require('../interventionRules.controller'))

beforeEach(() => {
  jest.clearAllMocks()
  adminState.isAdmin = true
  adminState.isCohortManager = false
})

describe('Intervention Rules controller', () => {
  describe('GET /intervention-rules', () => {
    it('returns 200 with bucketed payload for cohort managers', async () => {
      adminState.isAdmin = false
      adminState.isCohortManager = true
      svc.listAllBucketed.mockResolvedValue({ clinical: {}, didactic: {}, consistency: {} })
      const res = await request(app).get('/intervention-rules')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, clinical: {}, didactic: {}, consistency: {} })
    })

    it('returns 403 when neither admin nor cohort manager', async () => {
      adminState.isAdmin = false
      adminState.isCohortManager = false
      const res = await request(app).get('/intervention-rules')
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /admin/intervention-rules', () => {
    it('returns 200 for admins', async () => {
      svc.listAllBucketed.mockResolvedValue({ clinical: {}, didactic: {}, consistency: {} })
      const res = await request(app).get('/admin/intervention-rules')
      expect(res.status).toBe(200)
    })

    it('returns 401 when not admin', async () => {
      adminState.isAdmin = false
      const res = await request(app).get('/admin/intervention-rules')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /admin/intervention-rules', () => {
    it('returns 201 with the created rule', async () => {
      svc.create.mockResolvedValue({ id: 'r1', domain: 'clinical' })
      const res = await request(app)
        .post('/admin/intervention-rules')
        .send({ domain: 'clinical', skillId: 's', from: 0, to: 10, interventions: [{ text: 'x' }] })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ success: true, rule: { id: 'r1', domain: 'clinical' } })
      expect(svc.create).toHaveBeenCalledWith({
        body: expect.any(Object),
        userId: 1,
      })
    })

    it('maps service validation errors to 400 with success:false body', async () => {
      const err = new Error('`from` must be <= `to`')
      err.status = 400
      svc.create.mockRejectedValue(err)
      const res = await request(app).post('/admin/intervention-rules').send({ domain: 'clinical' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ success: false, error: '`from` must be <= `to`' })
    })
  })

  describe('PUT /admin/intervention-rules/:id', () => {
    it('returns 200 on success', async () => {
      svc.update.mockResolvedValue({ id: 'r1' })
      const res = await request(app)
        .put('/admin/intervention-rules/r1')
        .send({ from: 0, to: 100, interventions: [{ text: 'x' }] })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, rule: { id: 'r1' } })
    })

    it('returns 404 when service throws not-found', async () => {
      const err = new Error('Rule not found')
      err.status = 404
      svc.update.mockRejectedValue(err)
      const res = await request(app)
        .put('/admin/intervention-rules/missing')
        .send({ from: 0, to: 100, interventions: [{ text: 'x' }] })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /admin/intervention-rules/:id', () => {
    it('returns 204', async () => {
      svc.remove.mockResolvedValue()
      const res = await request(app).delete('/admin/intervention-rules/r1')
      expect(res.status).toBe(204)
    })

    it('returns 404 when service throws not-found', async () => {
      const err = new Error('Rule not found')
      err.status = 404
      svc.remove.mockRejectedValue(err)
      const res = await request(app).delete('/admin/intervention-rules/missing')
      expect(res.status).toBe(404)
    })
  })
})
