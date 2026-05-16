const { StackQuestion, sequelize } = require('../../db/models')

const StackQuestionSvc = {
  findByFieldStrengthPresetId: async function (fieldStrengthPresetId) {
    // Search for stackQuestions where ANY answer in the answers array has matching fieldStrengthPresetId
    const stackQuestions = await StackQuestion.findAll({
      where: sequelize.where(
        sequelize.literal(`EXISTS (
          SELECT 1 FROM json_array_elements("answers") AS answer
          WHERE (answer->>'fieldStrengthPresetId')::INTEGER = ${parseInt(fieldStrengthPresetId, 10)}
        )`),
        true
      ),
    })
    return stackQuestions
  },
  // Keep old method for backward compatibility
  findByContrastRangePresetId: async function (contrastRangePresetId) {
    const stackQuestions = await StackQuestion.findAll({
      where: {
        contrastRangePresetId: contrastRangePresetId,
      },
    })
    return stackQuestions
  },
}

module.exports = StackQuestionSvc
