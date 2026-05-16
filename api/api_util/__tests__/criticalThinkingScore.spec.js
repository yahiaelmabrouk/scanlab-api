const { v4: uuid } = require('uuid')
const subject = require('../criticalThinkingScore')

describe('criticalThinkingScore', () => {
  describe('#calculateMultipleAnswerScore', () => {
    describe('when a question has 2 correct answers', () => {
      describe('and a user submits 2 correct answers', () => {
        it('should return a score of 100', () => {
          const correctAnswer1 = { id: uuid(), isCorrect: true }
          const correctAnswer2 = { id: uuid(), isCorrect: true }
          const wrongAnswer1 = { id: uuid(), isCorrect: false }
          const wrongAnswer2 = { id: uuid(), isCorrect: false }

          const question = {
            choices: [correctAnswer1, correctAnswer2, wrongAnswer1, wrongAnswer2],
          }

          const answerData = [correctAnswer1.id, correctAnswer2.id].toString()

          const actual = subject.calculateMultipleAnswerScore(question, answerData)

          expect(actual).toBe(100)
        })
      })
      describe('and a user submits 2 correct answers, and 1 wrong answer', () => {
        it('should return a score of 50', () => {
          const correctAnswer1 = { id: uuid(), isCorrect: true }
          const correctAnswer2 = { id: uuid(), isCorrect: true }
          const wrongAnswer1 = { id: uuid(), isCorrect: false }
          const wrongAnswer2 = { id: uuid(), isCorrect: false }

          const question = {
            choices: [correctAnswer1, correctAnswer2, wrongAnswer1, wrongAnswer2],
          }

          const answerData = [correctAnswer1.id, correctAnswer2.id, wrongAnswer1.id].toString()

          const actual = subject.calculateMultipleAnswerScore(question, answerData)

          expect(actual).toBe(75)
        })
      })
      describe('and a user submits 1 correct answer', () => {
        it('should return a score of 50', () => {
          const correctAnswer1 = { id: uuid(), isCorrect: true }
          const correctAnswer2 = { id: uuid(), isCorrect: true }
          const wrongAnswer1 = { id: uuid(), isCorrect: false }
          const wrongAnswer2 = { id: uuid(), isCorrect: false }

          const question = {
            choices: [correctAnswer1, correctAnswer2, wrongAnswer1, wrongAnswer2],
          }

          const answerData = [correctAnswer1.id].toString()

          const actual = subject.calculateMultipleAnswerScore(question, answerData)

          expect(actual).toBe(50)
        })
      })
      describe('and a user submits 1 correct answer and 1 wrong answer', () => {
        it('should return a score of 50', () => {
          const correctAnswer1 = { id: uuid(), isCorrect: true }
          const correctAnswer2 = { id: uuid(), isCorrect: true }
          const wrongAnswer1 = { id: uuid(), isCorrect: false }
          const wrongAnswer2 = { id: uuid(), isCorrect: false }

          const question = {
            choices: [correctAnswer1, correctAnswer2, wrongAnswer1, wrongAnswer2],
          }

          const answerData = [correctAnswer1.id, wrongAnswer1.id].toString()

          const actual = subject.calculateMultipleAnswerScore(question, answerData)

          expect(actual).toBe(25)
        })
      })
      describe('and a user submits 2 wrong answers', () => {
        it('should return a score of 50', () => {
          const correctAnswer1 = { id: uuid(), isCorrect: true }
          const correctAnswer2 = { id: uuid(), isCorrect: true }
          const wrongAnswer1 = { id: uuid(), isCorrect: false }
          const wrongAnswer2 = { id: uuid(), isCorrect: false }

          const question = {
            choices: [correctAnswer1, correctAnswer2, wrongAnswer1, wrongAnswer2],
          }

          const answerData = [wrongAnswer1.id, wrongAnswer2.id].toString()

          const actual = subject.calculateMultipleAnswerScore(question, answerData)

          expect(actual).toBe(0)
        })
      })
    })
  })
})
