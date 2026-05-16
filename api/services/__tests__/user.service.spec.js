const mockApiUtil = require('../../api_util/api_util')
const mockDb = require('../../../db/models')

const subject = require('../user.service')

jest.mock('../../api_util/api_util', () => {
  return {
    errorHandler: jest.fn(),
    isAdmin: jest.fn(),
    isManager: jest.fn(),
    serializeUser: jest.fn(),
  }
})

jest.mock('../../../db/models', () => {
  return {
    User: {
      findOne: jest.fn(),
    },
  }
})

describe('User Service', () => {
  describe('#findUserById', () => {
    it('should dispatch to the error handler if any error is encountered', async () => {
      mockDb.User.findOne = jest.fn(() => {
        throw Error('Test Error')
      })

      mockApiUtil.isUserAdmin = jest.fn(() => {
        throw Error('Test Error')
      })

      const response = {}
      const userId = 123456789

      await subject.findUserById(userId, response)

      expect(mockApiUtil.errorHandler).toHaveBeenCalledTimes(1)
    })

    describe('when the user is an admin', () => {
      it('should append {isAdmin: true} to the user object', async () => {
        const userId = 123456789

        const user = {
          id: userId,
        }

        mockDb.User.findOne.mockResolvedValue(user)

        mockApiUtil.serializeUser.mockReturnValue(user)
        mockApiUtil.isAdmin.mockReturnValue(true)
        mockApiUtil.isManager.mockResolvedValue(false)

        const response = { json: jest.fn(() => response) }

        await subject.findUserById(userId, response)

        expect(mockApiUtil.errorHandler).not.toHaveBeenCalled()
        expect(mockDb.User.findOne).toHaveBeenCalledWith({ where: { id: userId } })
        expect(mockApiUtil.isAdmin).toHaveBeenCalledWith(user)
        expect(mockApiUtil.isManager).toHaveBeenCalledWith(user)
        expect(response.json).toHaveBeenCalledWith({ id: userId, isAdmin: true, isManager: false })
      })
    })

    describe('when the user is a manager', () => {
      it('should append {isAdmin: true} to the user object', async () => {
        const userId = 123456789

        const user = {
          id: userId,
        }

        mockDb.User.findOne.mockResolvedValue(user)

        mockApiUtil.serializeUser.mockReturnValue(user)
        mockApiUtil.isAdmin.mockReturnValue(false)
        mockApiUtil.isManager.mockResolvedValue(true)

        const response = { json: jest.fn(() => response) }

        await subject.findUserById(userId, response)

        expect(mockApiUtil.errorHandler).not.toHaveBeenCalled()
        expect(mockDb.User.findOne).toHaveBeenCalledWith({ where: { id: userId } })
        expect(mockApiUtil.isAdmin).toHaveBeenCalledWith(user)
        expect(mockApiUtil.isManager).toHaveBeenCalledWith(user)
        expect(response.json).toHaveBeenCalledWith({ id: userId, isAdmin: false, isManager: true })
      })
    })
  })
})
