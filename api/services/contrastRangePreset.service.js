const logger = require('../../util/logger')
const { ContrastRangePreset } = require('../../db/models')
const stackQuestionSvc = require('./stackQuestion.service')

const ContrastRangePresetSvc = {
  findAll: async function () {
    return await ContrastRangePreset.findAll({
      order: [['id', 'ASC']],
    })
  },
  create: async function (contrastRangePreset) {
    return await ContrastRangePreset.create(contrastRangePreset)
  },
  update: async function (contrastRangePreset) {
    await this.updateStackQuestionsPreset(contrastRangePreset)
    return await ContrastRangePreset.update(contrastRangePreset, { where: { id: contrastRangePreset.id } })
  },
  delete: async function (contrastRangePreset) {
    await this.removeStackQuestionsPreset(contrastRangePreset)
    return await ContrastRangePreset.destroy({ where: { id: contrastRangePreset } })
  },
  removeStackQuestionsPreset: async function (contrastRangePresetId) {
    const presetId = parseInt(contrastRangePresetId, 10)
    const stackQuestions = await stackQuestionSvc.findByFieldStrengthPresetId(presetId)
    for (const stackQuestion of stackQuestions) {
      // Remove preset from ALL answers that have this preset ID
      const answers = stackQuestion.answers.map((answer) => {
        if (answer.fieldStrengthPresetId == presetId) {
          return {
            ...answer,
            fieldStrengthRanges: this.removeContrastRangePresetValues(answer.fieldStrengthRanges),
            fieldStrengthPresetId: null,
          }
        }
        return answer
      })
      stackQuestion.answers = answers
      await stackQuestion.save()
    }
  },
  removeContrastRangePresetValues: function (prevRanges) {
    let newRanges = { 1.5: { min: {}, max: {} }, '3.0': { min: {}, max: {} } }
    newRanges['1.5']['min'].snr = prevRanges['1.5']['min']?.snr
    newRanges['1.5']['max'].snr = prevRanges['1.5']['max']?.snr
    newRanges['3.0']['min'].snr = prevRanges['3.0']['min']?.snr
    newRanges['3.0']['max'].snr = prevRanges['3.0']['max']?.snr

    return newRanges
  },
  updateStackQuestionsPreset: async function (contrastRangePreset) {
    const presetId = parseInt(contrastRangePreset.id, 10)
    const stackQuestions = await stackQuestionSvc.findByFieldStrengthPresetId(presetId)
    logger.info(`Updating ${stackQuestions.length} stack questions for preset ${presetId}`)
    for (const stackQuestion of stackQuestions) {
      // Update ALL answers that have this preset ID
      const answers = stackQuestion.answers.map((answer) => {
        if (answer.fieldStrengthPresetId == presetId) {
          const oldRanges = answer.fieldStrengthRanges
          const updatedRanges = this.updateContrastRangeValues(contrastRangePreset.ranges, oldRanges)
          return { ...answer, fieldStrengthRanges: updatedRanges }
        }
        return answer
      })

      // sequelize doesn't detect deep mutations, To avoid problems with save, you should treat each attribute as immutable and only assign new values.
      // https://sequelize.org/docs/v6/other-topics/upgrade/#-code-model-changed----code-
      stackQuestion.answers = answers
      await stackQuestion.save()
    }
    return null
  },
  updateContrastRangeValues: function (newVal, oldVal) {
    const updatedValue = {
      1.5: {
        max: {
          ...oldVal['1.5'].max,
          ...newVal['1.5'].max,
        },
        min: {
          ...oldVal['1.5'].min,
          ...newVal['1.5'].min,
        },
      },
      '3.0': {
        max: {
          ...oldVal['3.0'].max,
          ...newVal['3.0'].max,
        },
        min: {
          ...oldVal['3.0'].min,
          ...newVal['3.0'].min,
        },
      },
    }
    return updatedValue
  },
}

module.exports = ContrastRangePresetSvc
