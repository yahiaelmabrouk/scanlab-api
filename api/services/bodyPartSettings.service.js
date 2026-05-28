const { Cohort, CohortStudent, BodyPart, Region, sequelize } = require('../../db/models')
const notificationEvents = require('./notificationEvents')
const logger = require('../../util/logger')

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
 * Set difference helper: returns ids present in `before` but not `after`, and vice versa.
 */
function diffIds(before = [], after = []) {
  const b = new Set(before)
  const a = new Set(after)
  return {
    added: [...a].filter((id) => !b.has(id)),
    removed: [...b].filter((id) => !a.has(id)),
  }
}

async function resolveBodyPartNames(ids) {
  if (!ids || ids.length === 0) return []
  const rows = await BodyPart.findAll({ where: { id: ids }, attributes: ['id', 'name'] })
  return rows.map((r) => r.name).filter(Boolean)
}

async function resolveRegionNames(ids) {
  if (!ids || ids.length === 0) return []
  const rows = await Region.findAll({ where: { id: ids }, attributes: ['id', 'name'] })
  return rows.map((r) => r.name).filter(Boolean)
}

/**
 * Compares before/after body part settings and dispatches the relevant student
 * notifications. Fire-and-forget: never throws, never blocks the caller.
 *
 * Edge cases handled:
 *  - Unlocking a region emits both lockedRegions.remove and lockedBodyParts.remove;
 *    we report region + body-part names together as one "unlocked" event.
 *  - Locking an item also strips it from sandbox (sandboxedBodyParts.remove). That
 *    sandbox-off is a side effect of locking, not a deliberate "removed from sandbox"
 *    action, so we suppress it for any body part that became locked in the same change.
 *
 * @param {number[]} userIds - recipients (all cohort students, or the single student)
 * @param {Object} before    - body part settings before the change
 * @param {Object} after     - body part settings after the change
 */
async function dispatchSettingChangeNotifications(userIds, before, after) {
  try {
    const ids = (userIds || []).filter((id) => Number.isInteger(id))
    if (ids.length === 0) return

    const lockedBp = diffIds(before.lockedBodyParts, after.lockedBodyParts)
    const lockedRg = diffIds(before.lockedRegions, after.lockedRegions)
    const sandbox = diffIds(before.sandboxedBodyParts, after.sandboxedBodyParts)

    const newlyLocked = new Set(lockedBp.added)
    // Sandbox removals that are merely a consequence of locking are not real "removed
    // from sandbox" events.
    const sandboxDisabledIds = sandbox.removed.filter((id) => !newlyLocked.has(id))

    const [unlockedBpNames, unlockedRgNames, sandboxOnNames, sandboxOffNames] = await Promise.all([
      resolveBodyPartNames(lockedBp.removed),
      resolveRegionNames(lockedRg.removed),
      resolveBodyPartNames(sandbox.added),
      resolveBodyPartNames(sandboxDisabledIds),
    ])

    const unlockedNames = [...unlockedRgNames, ...unlockedBpNames]
    if (unlockedNames.length > 0) notificationEvents.notifyExamUnlocked(ids, unlockedNames)
    if (sandboxOnNames.length > 0) notificationEvents.notifyExamSandboxEnabled(ids, sandboxOnNames)
    if (sandboxOffNames.length > 0) notificationEvents.notifyExamSandboxDisabled(ids, sandboxOffNames)
  } catch (err) {
    logger.error(`[bodyPartSettings] dispatchSettingChangeNotifications failed: ${err.message}`)
  }
}

async function getCohortStudentUserIds(cohortId) {
  try {
    const students = await CohortStudent.findAll({ where: { cohortId }, attributes: ['userId'] })
    return students.map((s) => s.userId).filter((id) => Number.isInteger(id))
  } catch (err) {
    logger.error(`[bodyPartSettings] getCohortStudentUserIds failed (cohort ${cohortId}): ${err.message}`)
    return []
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
  let beforeSettings
  let afterSettings

  const result = await sequelize.transaction(async (transaction) => {
    // Acquire row lock using FOR UPDATE
    const cohort = await Cohort.findByPk(cohortId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })

    if (!cohort) {
      throw new Error('Cohort not found')
    }

    const currentSettings = cohort[target] || {}
    beforeSettings = extractBodyPartSettings(currentSettings)
    const updatedSettings = applyDeltaOperations(currentSettings, deltaOperations)

    // Update the settings field
    cohort[target] = updatedSettings
    // Mutating a JSON object requires telling Sequelize something changed
    cohort.changed(target, true)
    await cohort.save({ transaction })

    afterSettings = extractBodyPartSettings(updatedSettings)
    return afterSettings
  })

  // Fire-and-forget student notifications after the change is committed. Only the
  // manager-facing cohort settings reach students; adminSettings is a separate
  // admin-global control and is not surfaced as a student notification.
  if (target === 'settings') {
    const userIds = await getCohortStudentUserIds(cohortId)
    dispatchSettingChangeNotifications(userIds, beforeSettings, afterSettings)
  }

  return result
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
  let beforeSettings
  let afterSettings
  let studentUserId

  const result = await sequelize.transaction(async (transaction) => {
    // Acquire row lock using FOR UPDATE
    const student = await CohortStudent.findByPk(cohortStudentId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })

    if (!student) {
      throw new Error('Cohort student not found')
    }

    const currentSettings = student.settingsFromManager || {}
    beforeSettings = extractBodyPartSettings(currentSettings)
    studentUserId = student.userId
    const updatedSettings = applyDeltaOperations(currentSettings, deltaOperations)

    // Update the settings field
    student.settingsFromManager = updatedSettings
    // Mutating a JSON object requires telling Sequelize something changed
    student.changed('settingsFromManager', true)
    await student.save({ transaction })

    afterSettings = extractBodyPartSettings(updatedSettings)
    return {
      ...afterSettings,
      cohortId: student.cohortId,
    }
  })

  // Fire-and-forget: a per-student override only affects this one student.
  dispatchSettingChangeNotifications([studentUserId], beforeSettings, afterSettings)

  return result
}

module.exports = {
  applyDeltaOperations,
  extractBodyPartSettings,
  updateCohortBodyPartSettings,
  updateCohortStudentBodyPartSettings,
}
