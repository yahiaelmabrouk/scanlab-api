const _ = require('lodash')

const applyCorrectAnswers = (correct, provided) => {
  let score = 0

  provided.forEach((answer) => {
    if (_.includes(correct, answer)) {
      score += 1
    }
  })

  return score
}

const applyWrongAnswers = (correct, provided) => {
  let score = 0

  provided.forEach((answer) => {
    if (!_.includes(correct, answer)) {
      score -= 0.5
    }
  })

  return score
}

const calculateMultipleAnswerScore = (currentQuestion, answerData) => {
  // The right answer requires that you pick every correct answer (1 or many)
  // Right answer: All correct answer IDs, sorted alphabetically
  let correctAnswers = _.sortBy(_.map(_.filter(currentQuestion.choices, 'isCorrect'), 'id'))

  // Make sure we're sorting the user provided comma separated answerIds with the same sorting that we apply to our rightAnswerString
  let providedAnswers = _.sortBy(_.split(answerData, ','))

  let userScore = 0

  userScore += applyCorrectAnswers(correctAnswers, providedAnswers)
  userScore += applyWrongAnswers(correctAnswers, providedAnswers)

  if (userScore < 0) {
    userScore = 0
  }

  return (userScore / correctAnswers.length) * 100
}

module.exports = {
  calculateMultipleAnswerScore,
}
