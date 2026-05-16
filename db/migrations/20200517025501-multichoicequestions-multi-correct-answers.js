'use strict';

const _ = require('lodash')
const { MultipleChoiceQuestion } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Before there used to be only one right answer, yet each choice was always set false
    // So go through them all, and make sure the previously single right answer is set as isCorrect: true
    let questions = await MultipleChoiceQuestion.findAll()

    for(let question of questions){
      question.choices = _.map(question.choices, function(choice) {
        if(!choice.isCorrect && choice.id === question.answerIdentifier){
          choice.isCorrect = true
          console.log('set as correct',question.id,question.answerIdentifier)
        }
        return choice
      })
      await question.save()
    }
    console.log('Done')
  },

  down: (queryInterface, Sequelize) => {
  }
};
