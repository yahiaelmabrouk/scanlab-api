const { Cohort, CohortStudent, sequelize } = require('../../db/models')

/**
 * Applies delta operations (add/remove) to body part settings arrays.
 * Order: remove first, then add (so "remove wins" if same ID in both).
 *
 * @param {Object} currentSettings - The current settings object
 * @param {Object} deltaOperations - Delta operations to apply
 * @returns {Object} - Updated settings object
 */
function applyDeltaOperations(currentSettings, deltaOperations) {
  const updatedSettings = { ...currentSettings }
  const settingKeys = ['sandboxedBodyParts', 'lockedBodyParts', 'lockedRegions']

  for (const key of settingKeys) {
    if (deltaOperations[key]) {
      const currentArray = Array.isArray(updatedSettings[key]) ? [...updatedSettings[key]] : []
      const { add = [], remove = [] } = deltaOperations[key]

      // Use Set for O(1) lookups and deduplication
      const resultSet = new Set(currentArray)

      // Remove first (so "remove wins" if same ID in both add and remove)
      for (const id of remove) {
        resultSet.delete(id)
      }

      // Then add
      for (const id of add) {
        resultSet.add(id)
      }

      updatedSettings[key] = Array.from(resultSet)
    }
  }

  return updatedSettings
}

/**
 * Extracts only the body part settings fields from a full settings object.
 *
 * @param {Object} settings - Full settings object
 * @returns {Object} - Object with only body part settings arrays
 */
function extractBodyPartSettings(settings) {
  return {
    sandboxedBodyParts: settings.sandboxedBodyParts || [],
    lockedBodyParts: settings.lockedBodyParts || [],
    lockedRegions: settings.lockedRegions || [],
  }
}

/**
 * Atomically updates cohort body part settings using row locking.
 *
 * @param {number} cohortId - The cohort ID
 * @param {string} target - 'settings' or 'adminSettings'
 * @param {Object} deltaOperations - Delta operations to apply
 * @returns {Promise<Object>} - Updated body part settings
 * @throws {Error} - If cohort not found
 */
async function updateCohortBodyPartSettings(cohortId, target, deltaOperations) {
  return sequelize.transaction(async (transaction) => {
    // Acquire row lock using FOR UPDATE
    const cohort = await Cohort.findByPk(cohortId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })

    if (!cohort) {
      throw new Error('Cohort not found')
    }

    const currentSettings = cohort[target] || {}
    const updatedSettings = applyDeltaOperations(currentSettings, deltaOperations)

    // Update the settings field
    cohort[target] = updatedSettings
    // Mutating a JSON object requires telling Sequelize something changed
    cohort.changed(target, true)
    await cohort.save({ transaction })

    return extractBodyPartSettings(updatedSettings)
  })
}

/**
 * Atomically updates cohort student body part settings using row locking.
 *
 * @param {number} cohortStudentId - The cohort student ID
 * @param {Object} deltaOperations - Delta operations to apply
 * @returns {Promise<Object>} - Updated body part settings with cohortId
 * @throws {Error} - If cohort student not found
 */
async function updateCohortStudentBodyPartSettings(cohortStudentId, deltaOperations) {
  return sequelize.transaction(async (transaction) => {
    // Acquire row lock using FOR UPDATE
    const student = await CohortStudent.findByPk(cohortStudentId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })

    if (!student) {
      throw new Error('Cohort student not found')
    }

    const currentSettings = student.settingsFromManager || {}
    const updatedSettings = applyDeltaOperations(currentSettings, deltaOperations)

    // Update the settings field
    student.settingsFromManager = updatedSettings
    // Mutating a JSON object requires telling Sequelize something changed
    student.changed('settingsFromManager', true)
    await student.save({ transaction })

    return {
      ...extractBodyPartSettings(updatedSettings),
      cohortId: student.cohortId,
    }
  })
}

module.exports = {
  applyDeltaOperations,
  extractBodyPartSettings,
  updateCohortBodyPartSettings,
  updateCohortStudentBodyPartSettings,
}
