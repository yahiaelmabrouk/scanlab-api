const { v4: uuid } = require('uuid')
const subject = require('../api_util')
const db = require('../../../db/models')
const logger = require('../../../util/logger')

jest.mock('../../../db/models', () => {
  return {
    User: {
      findOne: jest.fn(),
    },
    CohortManager: {
      count: jest.fn(),
    },
  }
})

jest.mock('../../../util/logger', () => {
  return {
    error: jest.fn(),
    warn: jest.fn(),
  }
})

describe('api_util', () => {
  describe('#errorHandler', () => {
    it(`should apply the exception's error description to the response.json`, () => {
      const response = {
        json: jest.fn(() => response),
      }

      const error_description = 'Test Description'

      const exception = {
        error_description,
      }

      const message = null

      const expectedJson = {
        success: false,
        error_description,
      }

      subject.errorHandler(response, exception, message)

      expect(response.json).toHaveBeenCalledWith(expectedJson)
      expect(logger.error).not.toHaveBeenCalled()
    })

    it(`should apply the default Unknown Error message to the response.json`, () => {
      const response = {
        json: jest.fn(() => response),
      }

      const error_description = 'Unknown Error'

      const exception = {}

      const message = null

      const expectedJson = {
        success: false,
        error_description,
      }

      subject.errorHandler(response, exception, message)

      expect(response.json).toHaveBeenCalledWith(expectedJson)
      expect(logger.error).not.toHaveBeenCalled()
    })

    it(`should log the passed message if supplied`, () => {
      const response = {
        json: jest.fn(() => response),
      }

      const error_description = 'Test Description'

      const exception = {
        error_description,
      }

      const message = 'Test Message'

      const expectedJson = {
        success: false,
        error_description,
      }

      subject.errorHandler(response, exception, message)

      expect(response.json).toHaveBeenCalledWith(expectedJson)
      expect(logger.error).toHaveBeenCalledWith(message)
    })
  })

  describe('#isAdmin', () => {
    it('should return true if user is an admin', () => {
      const user = { isAdmin: true }

      const actual = subject.isAdmin(user)

      expect(actual).toBe(true)
    })

    it("should return true if user's email is present in ADMIN_EMAIL_ADDITIONAL", () => {
      const email = 'ada.lovelace@maths.com'
      process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,${email},sade@scanlab.com`

      const user = {
        isAdmin: false,
        email,
      }

      const actual = subject.isAdmin(user)

      expect(actual).toBe(true)
    })

    it("should return false if user's email is NOT present in ADMIN_EMAIL_ADDITIONAL", () => {
      const email = 'ada.lovelace@maths.com'
      process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,sade@scanlab.com`

      const user = {
        isAdmin: false,
        email,
      }

      const actual = subject.isAdmin(user)

      expect(actual).toBe(false)
    })
  })

  describe('#isManagerOrAdmin', () => {
    it('should throw an error if the promise fails', async () => {
      const user = {
        id: 1,
        isAdmin: false,
      }

      const expectedQuery = {
        where: {
          userId: user.id,
        },
      }

      db.CohortManager.count = jest.fn(() => {
        throw Error('Test Error')
      })

      let actual = false
      try {
        await subject.isManagerOrAdmin(user)
      } catch (err) {
        actual = true
      }

      expect(actual).toBe(true)
      expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
    })

    describe('Admin check', () => {
      it('should return true if user is an admin', async () => {
        const user = { isAdmin: true }

        const actual = await subject.isManagerOrAdmin(user)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).not.toHaveBeenCalled()
      })

      it("should return true if user's email is present in ADMIN_EMAIL_ADDITIONAL", async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,${email},sade@scanlab.com`

        const user = {
          isAdmin: false,
          email,
        }

        const actual = await subject.isManagerOrAdmin(user)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).not.toHaveBeenCalled()
      })

      it("should return false if user's email is NOT present in ADMIN_EMAIL_ADDITIONAL AND is not in the CohortManager table", async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,sade@scanlab.com`

        const user = {
          id: 999,
          isAdmin: false,
          email,
        }

        const expectedQuery = {
          where: {
            userId: user.id,
          },
        }

        db.CohortManager.count.mockResolvedValue(0)

        const actual = await subject.isManagerOrAdmin(user)

        expect(actual).toBe(false)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })
    })

    describe('Manager check', () => {
      it('should return true if user is a manager', async () => {
        const user = {
          id: 1,
          isAdmin: false,
        }

        const expectedQuery = {
          where: {
            userId: user.id,
          },
        }

        db.CohortManager.count.mockResolvedValue(1)

        const actual = await subject.isManagerOrAdmin(user)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })

      it('should return false if user is not found in the CohortManager table', async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,sade@scanlab.com`

        const user = {
          isAdmin: false,
          email,
        }

        const expectedQuery = {
          where: {
            userId: user.id,
          },
        }

        db.CohortManager.count.mockResolvedValue(0)

        const actual = await subject.isManagerOrAdmin(user)

        expect(actual).toBe(false)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })
    })
  })

  describe('#isManager', () => {
    it('should return true if user is a manager', async () => {
      const user = {
        id: 1,
      }

      const expectedQuery = {
        where: {
          userId: user.id,
        },
      }

      db.CohortManager.count.mockResolvedValue(1)

      const actual = await subject.isManager(user)

      expect(actual).toBe(true)
      expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
    })

    it('should return false if user is not found in the CohortManager table', async () => {
      const user = {
        id: 1,
      }

      const expectedQuery = {
        where: {
          userId: user.id,
        },
      }

      db.CohortManager.count.mockResolvedValue(0)

      const actual = await subject.isManager(user)

      expect(actual).toBe(false)
      expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
    })
  })

  describe('#isManagerOfCohortOrAdmin', () => {
    describe('Admin check', () => {
      it('should return true if user is an admin', async () => {
        const user = { isAdmin: true }

        const cohortId = uuid()

        const actual = await subject.isManagerOfCohortOrAdmin(user, cohortId)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).not.toHaveBeenCalled()
      })

      it("should return true if user's email is present in ADMIN_EMAIL_ADDITIONAL", async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,${email},sade@scanlab.com`

        const cohortId = uuid()

        const user = {
          isAdmin: false,
          email,
        }

        const actual = await subject.isManagerOfCohortOrAdmin(user, cohortId)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).not.toHaveBeenCalled()
      })

      it("should return false if user's email is NOT present in ADMIN_EMAIL_ADDITIONAL AND is not in the CohortManager table", async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,sade@scanlab.com`

        const user = {
          id: 999,
          isAdmin: false,
          email,
        }

        const cohortId = uuid()

        const expectedQuery = {
          where: {
            userId: user.id,
            cohortId: cohortId,
          },
        }

        db.CohortManager.count.mockResolvedValue(0)

        const actual = await subject.isManagerOfCohortOrAdmin(user, cohortId)

        expect(actual).toBe(false)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })
    })

    describe('Manager check', () => {
      it('should return true if user is a manager', async () => {
        const user = {
          id: 1,
          isAdmin: false,
        }

        const cohortId = uuid()

        const expectedQuery = {
          where: {
            userId: user.id,
            cohortId: cohortId,
          },
        }

        db.CohortManager.count.mockResolvedValue(1)

        const actual = await subject.isManagerOfCohortOrAdmin(user, cohortId)

        expect(actual).toBe(true)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })

      it('should return false if user is not found in the CohortManager table', async () => {
        const email = 'ada.lovelace@maths.com'
        process.env.ADMIN_EMAIL_ADDITIONAL = `adam@scanlab.com,sade@scanlab.com`

        const user = {
          isAdmin: false,
          email,
        }

        const cohortId = uuid()

        const expectedQuery = {
          where: {
            userId: user.id,
            cohortId: cohortId,
          },
        }

        db.CohortManager.count.mockResolvedValue(0)

        const actual = await subject.isManagerOfCohortOrAdmin(user, cohortId)

        expect(actual).toBe(false)
        expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
      })
    })
  })

  describe('#isManagerOfCohort', () => {
    it('should return true if user is a manager', async () => {
      const user = {
        id: 1,
      }

      const cohortId = uuid()

      const expectedQuery = {
        where: {
          userId: user.id,
          cohortId: cohortId,
        },
      }

      db.CohortManager.count.mockResolvedValue(1)

      const actual = await subject.isManagerOfCohort(user, cohortId)

      expect(actual).toBe(true)
      expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
    })

    it('should return false if user is not found in the CohortManager table', async () => {
      const user = {
        id: 1,
      }

      const cohortId = uuid()

      const expectedQuery = {
        where: {
          userId: user.id,
          cohortId: cohortId,
        },
      }

      db.CohortManager.count.mockResolvedValue(0)

      const actual = await subject.isManagerOfCohort(user, cohortId)

      expect(actual).toBe(false)
      expect(db.CohortManager.count).toHaveBeenCalledWith(expectedQuery)
    })
  })

  describe('#fetchLoggedInUser', () => {
    describe('when the auth middleware already cached the user on req.session.user', () => {
      it('should skip the DB query and call next directly', async () => {
        const next = jest.fn()
        const cachedUser = {
          id: 1,
          isAdmin: true,
          userInfo: { lastIPs: [], save: jest.fn() },
        }

        const request = {
          session: {
            userId: 1,
            user: cachedUser,
          },
          user: cachedUser,
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        }

        const response = {
          status: jest.fn(() => response),
          send: jest.fn(() => response),
        }

        await subject.fetchLoggedInUser(request, response, next)

        expect(next).toHaveBeenCalled()
        // Should NOT have queried the database
        expect(db.User.findOne).not.toHaveBeenCalled()
        expect(response.status).not.toHaveBeenCalled()
        expect(response.send).not.toHaveBeenCalled()
      })
    })

    describe('when the passed request object does have a userId in the session but no cached user', () => {
      it('should set req.user to the found user', async () => {
        const next = jest.fn()

        const request = {
          session: {
            userId: 1,
          },
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        }

        const response = {
          status: jest.fn(() => response),
          send: jest.fn(() => response),
        }

        const mockedUser = {
          isAdmin: true,
        }

        db.User.findOne.mockResolvedValue(mockedUser)

        await subject.fetchLoggedInUser(request, response, next)

        expect(next).toHaveBeenCalled()
        expect(response.status).not.toHaveBeenCalled()
        expect(response.send).not.toHaveBeenCalled()
      })

      it('should set res.status to 401 if the user is not found', async () => {
        const next = jest.fn()

        const request = {
          session: {
            userId: 1,
          },
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        }

        const response = {
          status: jest.fn(() => response),
          send: jest.fn(() => response),
        }

        db.User.findOne.mockResolvedValue(null)

        await subject.fetchLoggedInUser(request, response, next)

        expect(next).not.toHaveBeenCalled()
        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.send).toHaveBeenCalledWith('User not found')
      })
    })

    describe('when the passed request object does NOT have a user in the session', () => {
      it('should set response.status to 401 and NOT call the  passed next function', async () => {
        const next = jest.fn()

        const request = {
          session: {},
        }

        const response = {
          status: jest.fn(() => response),
          send: jest.fn(() => response),
        }

        await subject.fetchLoggedInUser(request, response, next)

        expect(next).not.toHaveBeenCalledWith()
        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.send).toHaveBeenCalledWith('Not logged in!')
      })
    })
  })

  describe('#requireAdmin', () => {
    it('should call the passed next function when user is an admin', () => {
      const next = jest.fn()

      const request = {
        session: {
          user: {
            id: 1,
            isAdmin: true,
          },
        },
      }

      const response = {
        status: jest.fn(),
        json: jest.fn(),
      }

      let actual = false

      try {
        subject.requireAdmin(request, response, next)
        actual = true
      } catch (error) {
        actual = false
      }

      expect(actual).toBe(true)
      expect(response.status).not.toHaveBeenCalled()
      expect(response.json).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should throw an Error if user does NOT have a session', () => {
      const next = jest.fn()

      const request = {
        session: {},
      }

      const response = {}

      let actual = false

      try {
        subject.requireAdmin(request, response, next)
      } catch (error) {
        actual = true
      }

      expect(actual).toBe(true)
    })

    it('should set the response to a 401 and populate error message when user is NOT an admin', () => {
      const next = jest.fn()

      const request = {
        session: {
          user: {
            id: 1,
            isAdmin: false,
            email: 'ada@lovelace.org',
          },
        },
      }

      const response = {
        status: jest.fn(() => response),
        json: jest.fn(() => response),
      }

      const expectedJson = {
        success: false,
        error: 'You must be an authorized admin to access this resource',
      }

      let actual = false

      try {
        subject.requireAdmin(request, response, next)
        actual = true
      } catch (error) {
        actual = false
      }

      expect(actual).toBe(true)
      expect(response.status).toHaveBeenCalledWith(401)
      expect(response.json).toHaveBeenCalledWith(expectedJson)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('#serializeUser', () => {
    it('should properly serialize a user object found from Sequelize', () => {
      const dbUser = {
        id: 1,
        legalName: 'Ada Lovelace',
        nickName: 'Da Queen',
        email: 'ada@lovelace.org',
        vendorStylePreference: 'Mathematics',
        language: 'English',
        other: 'property',
        ignored: 'value',
      }

      const expected = {
        id: dbUser.id,
        legalName: dbUser.legalName,
        nickName: dbUser.nickName,
        email: dbUser.email,
        vendorStylePreference: dbUser.vendorStylePreference,
        language: dbUser.language,
      }

      const actual = subject.serializeUser(dbUser)

      expect(actual).toEqual(expected)
      expect(actual.other).toBeUndefined()
      expect(actual.ignored).toBeUndefined()
    })
  })
})
