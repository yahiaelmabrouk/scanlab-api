const { CohortStudent, RegistrationCode } = require('../../db/models')

// These queries need the transaction to get accurate counts if codes or
// students were created in this transaction
async function retrieveCounts(cohort, transaction) {
  let codeOptions = {
    where: {
      cohortId: cohort.id,
      used: false,
    },
  }
  if (transaction) {
    codeOptions.transaction = transaction
  }
  let availableRegistrationCodesCount = await RegistrationCode.count(codeOptions)

  let studentOptions = {
    where: {
      cohortId: cohort.id,
    },
  }
  if (transaction) {
    studentOptions.transaction = transaction
  }
  let studentsCount = await CohortStudent.count(studentOptions)

  return {
    availableRegistrationCodesCount,
    studentsCount,
  }
}

async function updateCounts(cohort, transaction) {
  let counts = await retrieveCounts(cohort, transaction)

  cohort.availableRegistrationCodesCount = counts.availableRegistrationCodesCount
  cohort.studentsCount = counts.studentsCount

  let options = {}
  if (transaction) {
    options.transaction = transaction
  }
  return await cohort.save(options)
}

module.exports = { retrieveCounts, updateCounts }
