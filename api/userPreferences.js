const express = require('express')
const router = express.Router()
const { User, UserInformationEuWest, UserInformation } = require('../db/models')
const { getUserInfomationFromUserModel } = require('./api_util/api_util')

router.post('/userPreferences', async function (req, res) {
  let { vendorStylePreference, fieldStrengthPreference, softwareVendorPreference, softwareVersionPreference, sliceFrameRate, scientificMode, immersiveSound } = req.body
  let user = await User.findOne({
    where: { id: req.session.userId },
    include: [
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })

  const userInformation = getUserInfomationFromUserModel(user)
  if (!userInformation) {
    return res.status(400).json({ error: 'User information not found' })
  }

  if (vendorStylePreference) userInformation.vendorStylePreference = vendorStylePreference
  if (fieldStrengthPreference) userInformation.fieldStrengthPreference = fieldStrengthPreference
  if (softwareVendorPreference) userInformation.softwareVendorPreference = softwareVendorPreference
  if (softwareVersionPreference) userInformation.softwareVersionPreference = softwareVersionPreference
  if (sliceFrameRate) userInformation.sliceFrameRate = sliceFrameRate
  if (scientificMode !== undefined) userInformation.scientificMode = scientificMode
  if (typeof immersiveSound === 'boolean') {
    userInformation.settings = { ...(userInformation.settings || {}), immersiveSound }
  }

  await userInformation.save()
  res.json({ success: true })
})

router.post('/userDefaultLanguageCode', async function (req, res) {
  let { defaultLanguageCode } = req.body
  let user = await User.findOne({
    where: { id: req.session.userId },
    include: [
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })

  const userInformation = getUserInfomationFromUserModel(user)
  if (!userInformation) {
    return res.status(400).json({ error: 'User information not found' })
  }

  userInformation.defaultLanguageCode = defaultLanguageCode
  await userInformation.save()
  res.json({ success: true })
})

router.post('/userInjectionMode', async function (req, res) {
  let { injectionMode, defaultContrastOnlyProtocol, defaultContrastAndSalineProtocol } = req.body
  let user = await User.findOne({
    where: { id: req.session.userId },
    include: [
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })
  const userInformation = getUserInfomationFromUserModel(user)
  if (!userInformation) {
    return res.status(400).json({ error: 'User information not found' })
  }
  userInformation.injectionMode = injectionMode
  userInformation.defaultContrastOnlyProtocol = defaultContrastOnlyProtocol
  userInformation.defaultContrastAndSalineProtocol = defaultContrastAndSalineProtocol
  await userInformation.save()
  res.json({ success: true })
})

// This is the Contrast Dose Calculation Method
router.post('/userInjectCondition', async function (req, res) {
  let { injectCondition } = req.body
  let user = await User.findOne({
    where: { id: req.session.userId },
    include: [
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })
  const userInformation = getUserInfomationFromUserModel(user)
  if (!userInformation) {
    return res.status(400).json({ error: 'User information not found' })
  }
  userInformation.injectCondition = injectCondition
  await userInformation.save()
  res.json({ success: true })
})

router.post('/userSliceExpansionBehavior', async function (req, res) {
  let { sliceExpansionBehavior } = req.body
  let user = await User.findOne({
    where: { id: req.session.userId },
    include: [
      {
        model: UserInformationEuWest,
        as: 'userInfoEuWest',
      },
      {
        model: UserInformation,
        as: 'userInfo',
      },
    ],
  })
  const userInformation = getUserInfomationFromUserModel(user)
  if (!userInformation) {
    return res.status(400).json({ error: 'User information not found' })
  }
  userInformation.sliceExpansionBehavior = sliceExpansionBehavior
  await userInformation.save()
  res.json({ success: true })
})

module.exports = router
