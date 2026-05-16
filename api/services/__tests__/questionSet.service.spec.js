/* eslint-disable no-undef */
const _ = require('lodash')
const { v4: uuid } = require('uuid')

const util = require('../../api_util/questionSet.util')
const db = require('../../../db/models')

const subject = require('../questionSet.service')

jest.mock('../../api_util/questionSet.util', () => {
  return {
    fillInAndSerializeQuestionSet: jest.fn(),
    identifyMissingRequiredFields: jest.fn(),
  }
})

jest.mock('../../../util/logger', () => {
  return {
    info: jest.fn(),
  }
})

jest.mock('../../../db/models', () => {
  return {
    QuestionSet: {
      create: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    },
    BodyPart: {},
    StackQuestion: {
      create: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn(),
    },
  }
})

describe('QuestionSet Service', () => {
  describe('#findAllQuestionSets', () => {
    it('should return all of the QuestionSets', async () => {
      const questionSetId = uuid()
      const bodyPartId = uuid()

      const stackQuestion = {
        questionText: 'Stack Question Text',
        answers: ['Answer 1', 'Answer 2'],
        difficulty: 3,
        order: 3,
        ignoreInPlaneRotation: false,
      }

      const questionSet = {
        id: questionSetId,
        name: 'Question Set Name',
        stackQuestions: [stackQuestion],
        dicomFileSet: {},
        bodyPartId,
        isAvailable: true,
      }

      db.QuestionSet.findAll.mockResolvedValue([questionSet])
      util.fillInAndSerializeQuestionSet.mockResolvedValue(questionSet)

      const actual = await subject.findAllQuestionSets()

      expect(actual).toContain(questionSet)

      expect(db.QuestionSet.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['createdAt', 'DESC']],
          include: expect.arrayContaining([
            expect.objectContaining({ model: db.BodyPart, as: 'bodyPart' }),
            expect.objectContaining({ model: db.StackQuestion, as: 'stackQuestions' }),
          ]),
        })
      )
    })
  })

  describe('#findQuestionSetById', () => {
    it('should return the found QuestionSet by passed ID', async () => {
      const questionSetId = uuid()
      const bodyPartId = uuid()

      const stackQuestion = {
        questionText: 'Stack Question Text',
        answers: ['Answer 1', 'Answer 2'],
        difficulty: 3,
        order: 3,
        ignoreInPlaneRotation: false,
      }

      const questionSet = {
        id: questionSetId,
        name: 'Question Set Name',
        stackQuestions: [stackQuestion],
        dicomFileSet: {},
        bodyPartId,
        isAvailable: true,
      }

      db.QuestionSet.findByPk.mockResolvedValue(questionSet)

      const actual = await subject.findQuestionSetById(questionSet)

      expect(actual).toBe(questionSet)
    })
  })

  describe('#createQuestionSet', () => {
    describe('when passed QuestionSet is valid', () => {
      it('should create a QuestionSet', async () => {
        const questionSetId = uuid()
        const bodyPartId = uuid()

        const stackQuestion = {
          questionText: 'Stack Question Text',
          answers: ['Answer 1', 'Answer 2'],
          difficulty: 3,
          order: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          name: 'Question Set Name',
          dicomFileSet: {},
          bodyPartId,
          isAvailable: true,
        }

        const passedQuestionSet = questionSet
        passedQuestionSet.stackQuestions = [stackQuestion]

        const createdQuestionSet = questionSet
        createdQuestionSet.id = questionSetId

        util.identifyMissingRequiredFields = jest.fn(() => [])
        db.QuestionSet.create.mockResolvedValue(createdQuestionSet)
        db.sequelize.transaction.mockResolvedValue(stackQuestion)
        db.StackQuestion.create.mockResolvedValue(stackQuestion)
        util.fillInAndSerializeQuestionSet.mockResolvedValue(createdQuestionSet)

        try {
          await subject.createQuestionSet(passedQuestionSet)

          expect(util.identifyMissingRequiredFields).toHaveBeenCalledWith(passedQuestionSet)
          expect(db.QuestionSet.create).toHaveBeenCalled()
          expect(db.sequelize.transaction).toHaveBeenCalled()
        } catch (error) {
          fail(`This test should NOT have thrown an error: ${error}`)
        }
      })
    })

    describe('when passed QuestionSet is NOT valid', () => {
      it('should throw an error and NOT create a QuestionSet', async () => {
        const questionSet = {}

        const missingRequiredField = 'bodyPartId'

        util.identifyMissingRequiredFields = jest.fn(() => [missingRequiredField])

        try {
          await subject.createQuestionSet(questionSet)
          fail('This test should have thrown an error')
        } catch (error) {
          expect(util.identifyMissingRequiredFields).toHaveBeenCalledWith(questionSet)
        }
      })
    })
  })

  describe('#updateQuestionSet', () => {
    describe('when passed QuestionSet is valid', () => {
      it('should update the passed QuestionSet', async () => {
        const questionSetId = uuid()
        const bodyPartId = uuid()

        const stackQuestion = {
          questionText: 'Stack Question Text',
          answers: ['Answer 1', 'Answer 2'],
          difficulty: 3,
          order: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          id: questionSetId,
          name: 'Question Set Name',
          stackQuestions: [stackQuestion],
          dicomFileSet: {},
          bodyPartId,
          isAvailable: true,
        }

        const updateQuestionSet = questionSet

        util.identifyMissingRequiredFields = jest.fn(() => [])
        util.fillInAndSerializeQuestionSet.mockResolvedValue(questionSet)
        db.sequelize.transaction.mockResolvedValue({})

        try {
          const actual = await subject.updateQuestionSet(questionSet, updateQuestionSet)

          expect(actual).toBe(questionSet)
          expect(db.sequelize.transaction).toHaveBeenCalled()
        } catch (error) {
          fail(`Test threw an error when it should not have: ${error}`)
        }
      })
    })

    describe('when passed QuestionSet is NOT valid', () => {
      it('should throw a validation Error and NOT update the passed QuestionSet', async () => {
        const questionSetId = uuid()

        const stackQuestion = {
          questionText: 'Stack Question Text',
          answers: ['Answer 1', 'Answer 2'],
          difficulty: 3,
          order: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          id: questionSetId,
          name: 'Question Set Name',
          stackQuestions: [stackQuestion],
          dicomFileSet: {},
          isAvailable: true,
        }

        const updateQuestionSet = questionSet
        _.unset(updateQuestionSet, 'stackQuestions')
        updateQuestionSet.getStackQuestions = jest.fn(() => [stackQuestion])

        const missingRequiredField = 'bodyPartId'

        util.identifyMissingRequiredFields = jest.fn(() => [missingRequiredField])

        try {
          await subject.updateQuestionSet(questionSet, updatedQuestionSet)

          fail('An error should have been thrown')
        } catch (error) {
          expect(util.fillInAndSerializeQuestionSet).not.toHaveBeenCalled()
          expect(db.sequelize.transaction).not.toHaveBeenCalled()
        }
      })
    })
  })

  describe('#deleteQuestionSet', () => {
    it('should delete the passed QuestionSet', async () => {
      const questionSetId = uuid()
      const bodyPartId = uuid()

      const stackQuestion = {
        questionText: 'Stack Question Text',
        answers: ['Answer 1', 'Answer 2'],
        difficulty: 3,
        order: 3,
        ignoreInPlaneRotation: false,
      }

      const questionSet = {
        id: questionSetId,
        name: 'Question Set Name',
        getStackQuestions: jest.fn().mockResolvedValue([stackQuestion]),
        dicomFileSet: {},
        bodyPartId,
        isAvailable: true,
      }

      db.sequelize.transaction.mockResolvedValue({})

      await subject.deleteQuestionSet(questionSet)

      expect(db.sequelize.transaction).toHaveBeenCalled()
    })
  })
})
