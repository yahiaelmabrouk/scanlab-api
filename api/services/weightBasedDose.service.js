const { WeightBasedDose } = require('../../db/models')

const getAllWeightBasedDoses = async () => {
  let data = await WeightBasedDose.findAll({
    order: [['weightMetric', 'ASC']],
  })

  return data
}

const weightBasedDoseService = {
  getAllWeightBasedDoses,
}

module.exports = weightBasedDoseService
