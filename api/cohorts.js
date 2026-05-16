const _ = require('lodash')
const { DEFAULT_VENDOR_UIS } = require('../util/constants/vendorUIs')
const express = require('express')
const service = require('./services/cohorts.service')
const bodyPartSettingsService = require('./services/bodyPartSettings.service')
const {
  fetchLoggedInUser,
  requireAdmin,
  isManagerOfCohortOrAdmin,
  errorHandler,
  isAdmin,
} = require('./api_util/api_util')
const { validateCohortAccess } = require('./api_util/cohortAccessValidator')
const { v, Joi } = require('./api_util/validator')
const { Cohort } = require('../db/models')

/**
 * Merges default vendorUIs into cohort.adminSettings.vendorUIs
 * Preserves any existing settings while filling in missing vendors
 */
function mergeVendorUIDefaults(cohort) {
  if (cohort) {
    const data = cohort.dataValues || cohort
    if (!data.adminSettings) {
      data.adminSettings = {}
    }
    data.adminSettings.vendorUIs = _.defaultsDeep({}, data.adminSettings.vendorUIs || {}, DEFAULT_VENDOR_UIS)
  }
  return cohort
}

const router = express.Router()

router.get('/cohorts', fetchLoggedInUser, async function (req, res) {
  let cohorts = await service.findAllCohorts(
    req.session.user,
    req.query.managedByMe === 'true',
    req.query.mine === 'true'
  )
  return res.json({ success: true, cohorts })
})

router.get('/cohorts/:id', fetchLoggedInUser, validateCohortAccess(), async function (req, res) {
  try {
    let cohort = await Cohort.findOne({
      attributes: [
        'id',
        'name',
        'availableRegistrationCodesCount',
        'studentsCount',
        'settings',
        'adminSettings',
        'expirationLength',
      ],
      where: {
        id: req.params.id,
      },
    })

    if (cohort === null) {
      res.status(404).json({ success: false })
    } else {
      mergeVendorUIDefaults(cohort)
      res.json({ success: true, cohort })
    }
  } catch (err) {
    errorHandler(res, err)
  }
})

router.post('/cohorts', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let cohort = await Cohort.create(_.extend(req.body, { availableRegistrationCodesCount: 0, studentsCount: 0 }))

    res.json({ success: true, cohort })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.put('/cohorts/:id', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let cohort = await Cohort.findOne({
      attributes: ['id', 'name', 'availableRegistrationCodesCount', 'studentsCount', 'settings', 'adminSettings'],
      where: {
        id: req.params.id,
      },
    })
    if (cohort === null) {
      res.status(404).json({ success: false })
      return
    }
    const { name } = req.body

    if (name) {
      cohort.name = name
    }

    await cohort.save()
    res.json({ success: true, cohort })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.patch('/cohorts/:id', fetchLoggedInUser, async function (req, res) {
  try {
    let userIsAdmin = isAdmin(req.session.user)
    let cohort = await Cohort.findOne({
      attributes: ['id', 'name', 'availableRegistrationCodesCount', 'studentsCount', 'settings', 'adminSettings'],
      where: {
        id: req.params.id,
      },
    })

    if (cohort === null) {
      res.status(404).json({ success: false })
      return
    }
    // putting this after looking for the cohort itself so that if the cohort does not exist,
    // we still return a 404 instead of a 401
    else if (!(await isManagerOfCohortOrAdmin(req.session.user, req.params.id))) {
      const errorMessage = 'You must be an authorized manager of this cohort to access this resource'
      res.status(401).json({ success: false, error: errorMessage })
      return
    }

    if (!cohort.adminSettings) {
      cohort.adminSettings = {}
    }

    const { adminSettings, settings, expirationLength } = req.body
    const patchingSettings = adminSettings || settings

    if (patchingSettings) {
      const isAdminUpdated = userIsAdmin && adminSettings
      if (isAdminUpdated) {
        Object.assign(cohort.adminSettings, adminSettings)
      } else {
        Object.assign(cohort.settings, settings)
      }
      // mutating a json object requires that we tell sequelize something changed
      if (isAdminUpdated) {
        cohort.changed('adminSettings', true)
      } else {
        cohort.changed('settings', true)
      }
      await cohort.save()
    }

    if (expirationLength) {
      cohort.expirationLength = expirationLength
      await cohort.save()
    }

    res.json({ success: true, cohort })
  } catch (err) {
    errorHandler(res, err)
  }
})

// Validation schema for body part settings delta operations
const deltaOperationSchema = Joi.object({
  add: Joi.array().items(Joi.number().integer()).default([]),
  remove: Joi.array().items(Joi.number().integer()).default([]),
})

const bodyPartSettingsValidation = {
  params: Joi.object({ id: Joi.number().integer().required() }),
  query: Joi.object({ target: Joi.string().valid('settings', 'adminSettings').default('settings') }),
  body: Joi.object({
    sandboxedBodyParts: deltaOperationSchema,
    lockedBodyParts: deltaOperationSchema,
    lockedRegions: deltaOperationSchema,
  }).min(1),
}

/**
 * PATCH /cohorts/:id/body-part-settings
 * Updates body part settings atomically using add/remove operations to prevent race conditions.
 *
 * Query params:
 *   - target: 'settings' (default) or 'adminSettings'
 *
 * Authorization:
 *   - target='settings': requires cohort manager or admin
 *   - target='adminSettings': requires admin only
 */
router.patch(
  '/cohorts/:id/body-part-settings',
  fetchLoggedInUser,
  validateCohortAccess(),
  v(bodyPartSettingsValidation),
  async function (req, res) {
    try {
      const cohortId = parseInt(req.params.id, 10)
      const target = req.query.target || 'settings'

      // Check cohort exists first (for 404 before 403)
      const cohort = await Cohort.findByPk(cohortId)
      if (!cohort) {
        return res.status(404).json({ success: false, error: 'Cohort not found' })
      }

      // Authorization
      if (target === 'adminSettings') {
        if (!isAdmin(req.session.user)) {
          return res.status(403).json({ success: false, error: 'Only administrators can modify admin settings' })
        }
      } else {
        if (!(await isManagerOfCohortOrAdmin(req.session.user, cohortId))) {
          return res.status(403).json({
            success: false,
            error: 'You must be a manager of this cohort or an admin',
          })
        }
      }

      const data = await bodyPartSettingsService.updateCohortBodyPartSettings(cohortId, target, req.body)
      return res.json({ success: true, data })
    } catch (err) {
      errorHandler(res, err)
    }
  }
)

module.exports = router
