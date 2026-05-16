const { QuestionGroup } = require('../../db/models')

const QuestionGroupService = {
  getQuestionGroups: async () => {
    return await QuestionGroup.findAll()
  },

  getQuestionGroupById: async (id) => {
    return await QuestionGroup.findByPk(id)
  },

  addQuestionGroup: async (questionGroupData) => {
    return await QuestionGroup.create(questionGroupData)
  },

  updateQuestionGroup: async (id, questionGroupData) => {
    const questionGroup = await QuestionGroup.findByPk(id)
    if (questionGroup) {
      return await questionGroup.update(questionGroupData)
    }
    return null
  },

  deleteQuestionGroup: async (id) => {
    const questionGroup = await QuestionGroup.findByPk(id)
    if (questionGroup) {
      await questionGroup.destroy()
      return true
    }
    return false
  },
}

module.exports = QuestionGroupService
