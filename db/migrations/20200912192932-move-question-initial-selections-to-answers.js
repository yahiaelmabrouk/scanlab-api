'use strict';
const _ = require('lodash')
const { StackQuestion } = require('../models');
const { getGroupsFromIdentsArray } = require('../../api/api_util/score');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('> Migrating StackQuestions')
    let stackQuestions = await StackQuestion.findAll();
    for(const stackQuestion of stackQuestions){

      if(_.isArray(stackQuestion.initialSelection)){
        console.log('Migrating stackQuestion', stackQuestion.id)
        let initialSelections =  stackQuestion.initialSelection

        console.log(` Copying ${initialSelections.length} initialSelections from Question into answers`)
        stackQuestion.answers = _.map(stackQuestion.answers, function (answer, answerIndex) {
          // [{id, name},...]
          let groups = getGroupsFromIdentsArray(_.keys(answer))

          if(groups.length !== initialSelections.length){
            throw Error(`Failed. Different amount of groups in ${answerIndex} than in initialSelections for StackQuestion ${stackQuestion.id}`)
          }

          _.each(groups, function(group, index) {
            if(!answer[`${group.id}_min`] || !answer[`${group.id}_max`]){
              throw Error(`Failed. Missing Min or Max for ${answerIndex} ${ident} in StackQuestion ${stackQuestion.id}`)
            }

            let ident = `${group.id}_proposed`
            let selectionData = _.get(initialSelections, index);
            if(!selectionData){
              throw Error(`Failed. No initialSelection for ${answerIndex} ${ident} in StackQuestion ${stackQuestion.id}`)
            }
            answer[ident] = selectionData
          })

          return answer
        })

        await stackQuestion.save()
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    return true
  }
};