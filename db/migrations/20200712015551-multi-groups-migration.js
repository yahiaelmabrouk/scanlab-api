'use strict';

const _ = require('lodash')
const { StackQuestion, StackQuestionResult } = require('../models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('> Migrating StackQuestions')
    let stackQuestions = await StackQuestion.findAll();
    for(const stackQuestion of stackQuestions){
      console.log('Migrating stackQuestion', stackQuestion.id)

      // stackQuestion.initialSelection
      if(stackQuestion.initialSelection && !_.isArray(stackQuestion.initialSelection)){
        console.log(' initialSelection was not an array:',stackQuestion.initialSelection)
        stackQuestion.initialSelection = [stackQuestion.initialSelection]
      }
      // give it an initial selection if it doesn't have one
      if(!stackQuestion.initialSelection){
        stackQuestion.initialSelection = [{"xDirectionX":1,"xDirectionY":0,"xDirectionZ":0,"yDirectionX":0,"yDirectionY":1,"yDirectionZ":0,"zDirectionX":0,"zDirectionY":1,"zDirectionZ":0,"centerX":72.04153846153844,"centerY":61.00307692307692,"centerZ":26.2723076923077,"dimensionX":146,"dimensionY":62,"dimensionZ":78,"numberOfSlices":14,"thickness":3,"spacing":3}]
      }

      // stackQuestion.answers -> id/name/min/max/proposed -> id/name/0_min/0_max
      stackQuestion.answers = _.map(stackQuestion.answers, function (answer) {
        // This wasn't actually used
        if(answer.proposed){
          console.log(' deleting answer.proposed:',answer.proposed)
          delete answer.proposed
        }

        // Min/Max are not prefixed by their groupId
        if(answer.min){
          answer['0_min'] = answer.min
          delete answer.min
        }
        if(answer.max){
          answer['0_max'] = answer.max
          delete answer.max
        }
        return answer
      })

      await stackQuestion.save()
    }


    console.log('> Migrating StackQuestionResults')
    let stackQuestionResults = await StackQuestionResult.findAll();
    for(const stackQuestionResult of stackQuestionResults){
      console.log('Migrating stackQuestionResult', stackQuestionResult.id)

      // stackQuestion.initialSelection
      if(stackQuestionResult.answer && !_.isArray(stackQuestionResult.answer)){
        console.log(' stackQuestionResult.answer was not an array:',stackQuestionResult.answer)
        stackQuestionResult.answer = [stackQuestionResult.answer]
      }

      await stackQuestionResult.save()
    }
  },


  down: async (queryInterface, Sequelize) => {
    console.log('> UnMigrating StackQuestions')
    let stackQuestions = await StackQuestion.findAll();
    for(const stackQuestion of stackQuestions){
      console.log('UnMigrating stackQuestion', stackQuestion.id)

      // stackQuestion.initialSelection
      if(stackQuestion.initialSelection && _.isArray(stackQuestion.initialSelection)){
        console.log(' initialSelection was an array:',stackQuestion.initialSelection)
        stackQuestion.initialSelection = _.first(stackQuestion.initialSelection)
      }

      // stackQuestion.answers -> id/name/min/max/proposed -> id/name/0_min/0_max
      stackQuestion.answers = _.map(stackQuestion.answers, function (answer) {
        // Min/Max are not prefixed by their groupId
        if(!answer.min && answer['0_min']){
          answer.min = answer['0_min']
          delete answer['0_min']
        }
        if(!answer.max && answer['0_max']){
          answer.max = answer['0_max']
          delete answer['0_max']
        }
        return answer
      })

      await stackQuestion.save()
    }

    console.log('> Not UnMigrating StackQuestionResults.answer (because it is not used yet anyway)')

  }
};
