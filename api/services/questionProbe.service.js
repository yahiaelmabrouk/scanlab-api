const { QuestionProbe } = require('../../db/models')

const QuestionProbeService = {
  getQuestionProbes: async () => {
    return await QuestionProbe.findAll()
  },

  getQuestionProbeById: async (id) => {
    return await QuestionProbe.findByPk(id)
  },

  getQuestionProbeByBodyPartId: async (id, scanDirection) => {
    return await QuestionProbe.findAll({
      where: {
        bodyPartId: id,
        scanDirection,
      },
    })
  },

  addQuestionProbe: async (questionProbeData) => {
    return await QuestionProbe.create(questionProbeData)
  },

  updateQuestionProbe: async (id, questionProbeData) => {
    const questionProbe = await QuestionProbe.findByPk(id)
    if (questionProbe) {
      return await questionProbe.update(questionProbeData)
    }
    return null
  },

  deleteQuestionProbe: async (id) => {
    const questionProbe = await QuestionProbe.findByPk(id)
    if (questionProbe) {
      await questionProbe.destroy()
      return true
    }
    return false
  },
}

module.exports = QuestionProbeService
