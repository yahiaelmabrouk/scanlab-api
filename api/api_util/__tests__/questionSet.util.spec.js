const { v4: uuid } = require('uuid')
const subject = require('../questionSet.util')

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

describe('questionSet.util', () => {
  describe('#fillInAndSerializeQuestionSet', () => {
    describe('when removeAnswersContent is TRUE', () => {
      it('should return the stackQuestion with NO min and max values present', async () => {
        const bodyPartId = uuid()
        const stackId = uuid()
        const questionSetId = uuid()

        const answer = {
          something_min: 0,
          something_max: 100,
        }

        const stackQuestion = {
          id: stackId,
          questionText: 'Question Text',
          answers: [answer],
          order: 1,
          difficulty: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          id: questionSetId,
          name: 'Question Name',
          dicomFileSet: {},
          bodyPartId: bodyPartId,
          isAvailable: true,
          getStackQuestions: () => [stackQuestion],
          someKey: 'that will be removed',
        }

        const removeAnswersContent = true

        const expected = {
          id: questionSetId,
          name: 'Question Name',
          dicomFileSet: {},
          bodyPartId: bodyPartId,
          isAvailable: true,
          stackQuestions: [
            {
              id: stackId,
              questionText: 'Question Text',
              answers: [{}],
              order: 1,
              difficulty: 3,
              ignoreInPlaneRotation: false,
            },
          ],
        }

        const actual = await subject.fillInAndSerializeQuestionSet(questionSet, removeAnswersContent)

        expect(actual).toEqual(expected)
      })
    })

    describe('when removeAnswersContent is FALSE', () => {
      it('should return the full stackQuestion with min and max values present', async () => {
        const bodyPartId = uuid()
        const stackId = uuid()
        const questionSetId = uuid()

        const answer = {
          something_min: 0,
          something_max: 100,
        }

        const stackQuestion = {
          id: stackId,
          questionText: 'Question Text',
          answers: [answer],
          order: 1,
          difficulty: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          id: questionSetId,
          name: 'Question Name',
          dicomFileSet: {},
          bodyPartId: bodyPartId,
          isAvailable: true,
          getStackQuestions: () => [stackQuestion],
          someKey: 'that will be removed',
        }

        const removeAnswersContent = false

        const expected = {
          id: questionSetId,
          name: 'Question Name',
          dicomFileSet: {},
          bodyPartId: bodyPartId,
          isAvailable: true,
          stackQuestions: [stackQuestion],
        }

        const actual = await subject.fillInAndSerializeQuestionSet(questionSet, removeAnswersContent)

        expect(actual).toEqual(expected)
      })
    })
  })

  describe('identifyMissingRequiredFields', () => {
    describe('when the passed QuestionSet is valid', () => {
      it('should return an empty array', () => {
        const answerId = uuid()
        const bodyPartId = uuid()
        const stackId = uuid()

        const answer = {
          id: answerId,
          something_min: 0,
          something_max: 100,
        }

        const stackQuestion = {
          id: stackId,
          questionText: 'Question Text',
          answers: [answer],
          order: 1,
          difficulty: 3,
          ignoreInPlaneRotation: false,
        }

        const questionSet = {
          name: 'Data Name',
          stackQuestions: [stackQuestion],
          dicomFileSet: {},
          bodyPartId,
        }

        const actual = subject.identifyMissingRequiredFields(questionSet)

        expect(actual).toBeEmpty()
      })
    })

    describe('when the passed QuestionSet is NOT valid', () => {
      describe('when stackQuestions is empty', () => {
        it('should return an array with one error', () => {
          const bodyPartId = uuid()

          const questionSet = {
            name: 'Data Name',
            stackQuestions: [],
            dicomFileSet: {},
            bodyPartId,
          }

          const actual = subject.identifyMissingRequiredFields(questionSet)

          expect(actual).toContain('stackQuestions')
        })
      })

      describe('when dicomFileSet is undefined', () => {
        it('should return an array with one error', () => {
          const bodyPartId = uuid()
          const stackId = uuid()

          const answer = {
            something_min: 0,
            something_max: 100,
          }

          const stackQuestion = {
            id: stackId,
            questionText: 'Question Text',
            answers: [answer],
            order: 1,
            difficulty: 3,
            ignoreInPlaneRotation: false,
          }

          const questionSet = {
            name: 'Data Name',
            stackQuestions: [stackQuestion],
            bodyPartId,
          }

          const actual = subject.identifyMissingRequiredFields(questionSet)

          expect(actual).toContain('dicomFileSet')
        })
      })

      describe('when bodyPartId is undefined', () => {
        it('should return an array with one error', () => {
          const stackId = uuid()

          const answer = {
            something_min: 0,
            something_max: 100,
          }

          const stackQuestion = {
            id: stackId,
            questionText: 'Question Text',
            answers: [answer],
            order: 1,
            difficulty: 3,
            ignoreInPlaneRotation: false,
          }

          const questionSet = {
            name: 'Data Name',
            stackQuestions: [stackQuestion],
            dicomFileSet: {},
          }

          const actual = subject.identifyMissingRequiredFields(questionSet)

          expect(actual).toContain('bodyPartId')
        })
      })

      describe('when a stackQuestion has NO answers', () => {
        it('should return an array with one error', () => {
          const bodyPartId = uuid()
          const stackId = uuid()

          const stackQuestion = {
            id: stackId,
            questionText: 'Question Text',
            answers: [],
            order: 1,
            difficulty: 3,
            ignoreInPlaneRotation: false,
          }

          const questionSet = {
            name: 'Data Name',
            stackQuestions: [stackQuestion],
            dicomFileSet: {},
            bodyPartId,
          }

          const actual = subject.identifyMissingRequiredFields(questionSet)

          expect(actual).toContain('stackQuestions.answers')
        })
      })

      describe('when a stackQuestion has answers with NO ID', () => {
        it('should return an array with one error', () => {
          const bodyPartId = uuid()
          const stackId = uuid()

          const answer = {
            something_min: 0,
            something_max: 100,
          }

          const stackQuestion = {
            id: stackId,
            questionText: 'Question Text',
            answers: [answer],
            order: 1,
            difficulty: 3,
            ignoreInPlaneRotation: false,
          }

          const questionSet = {
            name: 'Data Name',
            stackQuestions: [stackQuestion],
            dicomFileSet: {},
            bodyPartId,
          }

          const actual = subject.identifyMissingRequiredFields(questionSet)

          expect(actual).toContain('stackQuestions.answers.minMax')
        })
      })
    })
  })
})
