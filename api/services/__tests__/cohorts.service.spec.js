const mockApiUtil = require('../../api_util/api_util')
const db = require('../../../db/models')

const subject = require('../cohorts.service')

jest.mock('../../api_util/api_util', () => {
  return {
    isAdmin: jest.fn(),
    isManagerOrAdmin: jest.fn(),
    isManagerOfCohort: jest.fn(),
    isManagerOfCohortOrAdmin: jest.fn(),
    errorHandler: jest.fn(),
  }
})

jest.mock('../../../db/models', () => {
  return {
    Cohort: {
      findAll: jest.fn(),
    },
  }
})

describe('cohorts.service', () => {
  describe('#findAllCohorts', () => {
    describe('when the `managedByMe` property is `true`', () => {
      describe('and the user is a manager of the cohort', () => {
        it('should look up all cohorts associated with the user', async () => {
          const managerCohortId = 1
          const managerCohortIds = [managerCohortId]

          const expectedQuery = {
            order: [['name', 'ASC']],
            attributes: ['id', 'name', 'availableRegistrationCodesCount', 'studentsCount', 'settings'],
            where: { id: managerCohortIds },
          }

          mockApiUtil.isManagerOfCohort.mockResolvedValue(true)

          db.Cohort.findAll.mockResolvedValue([])

          const getCohortManagers = jest.fn().mockResolvedValue([{ cohortId: managerCohortId }])

          const user = { getCohortManagers }

          const managedByMe = true

          const mine = false

          const response = await subject.findAllCohorts(user, managedByMe, mine)

          expect(mockApiUtil.isManagerOfCohort).toHaveBeenCalledWith(user)
          expect(db.Cohort.findAll).toHaveBeenCalledWith(expectedQuery)
          expect(response).toStrictEqual([])
        })
      })

      describe('and the user is NOT a manager of the cohort', () => {
        it('should return a 401', async () => {
          mockApiUtil.isManagerOfCohort.mockResolvedValue(false)

          const user = {}

          const managedByMe = true

          const mine = false

          await expect(async () => subject.findAllCohorts(user, managedByMe, mine)).rejects.toThrow(
            'Unauthorized: Must be a manager to access your own cohorts'
          )
          expect(mockApiUtil.isManagerOfCohort).toHaveBeenCalledWith(user)
          expect(db.Cohort.findAll).not.toHaveBeenCalled()
        })
      })
    })

    describe('when the `managedByMe` property is `false`', () => {
      describe('and the `mine` property is `true`', () => {
        it('should look up all cohorts associated with the student user', async () => {
          const studentCohortId = 1
          const studentCohortIds = [studentCohortId]

          const expectedQuery = {
            order: [['name', 'ASC']],
            attributes: ['id', 'name', 'availableRegistrationCodesCount', 'studentsCount', 'settings'],
            where: { id: studentCohortIds },
          }

          mockApiUtil.isManagerOfCohort.mockResolvedValue(true)

          db.Cohort.findAll.mockResolvedValue([])

          const getCohortStudents = jest.fn().mockResolvedValue([{ cohortId: studentCohortId }])

          const user = { getCohortStudents }

          const managedByMe = false

          const mine = true

          const response = await subject.findAllCohorts(user, managedByMe, mine)

          expect(mockApiUtil.isManagerOfCohort).not.toHaveBeenCalled()
          expect(db.Cohort.findAll).toHaveBeenCalledWith(expectedQuery)
          expect(response).toStrictEqual([])
        })
      })

      describe('and the `mine` property is `false`', () => {
        describe('and the user is an admin', () => {
          it('should look up all cohorts associated with the student user', async () => {
            const studentCohortId = 1

            const expectedQuery = {
              order: [['name', 'ASC']],
              attributes: ['id', 'name', 'availableRegistrationCodesCount', 'studentsCount', 'settings'],
            }

            mockApiUtil.isAdmin.mockResolvedValue(true)

            db.Cohort.findAll.mockResolvedValue([])

            const getCohortStudents = jest.fn().mockResolvedValue([{ cohortId: studentCohortId }])

            const user = { getCohortStudents }

            const managedByMe = false

            const mine = false

            const response = await subject.findAllCohorts(user, managedByMe, mine)

            expect(mockApiUtil.isAdmin).toHaveBeenCalled()
            expect(db.Cohort.findAll).toHaveBeenCalledWith(expectedQuery)
            expect(response).toStrictEqual([])
          })
        })

        describe('and the user is NOT an admin', () => {
          it('should return a 401', async () => {
            mockApiUtil.isAdmin.mockResolvedValue(false)

            const user = {}

            const managedByMe = false

            const mine = false

            await expect(async () => subject.findAllCohorts(user, managedByMe, mine)).rejects.toThrow(
              'Unauthorized: Must be an admin to access ALL cohorts'
            )
            expect(mockApiUtil.isAdmin).toHaveBeenCalledWith(user)
            expect(db.Cohort.findAll).not.toHaveBeenCalled()
          })
        })
      })
    })
  })
})
