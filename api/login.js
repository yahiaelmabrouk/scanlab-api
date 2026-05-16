const express = require('express')
const router = express.Router()
const _ = require('lodash')
const moment = require('moment/moment')
const { v4: uuidv4 } = require('uuid')
const { Op } = require('sequelize')
const { sequelize, User, RegistrationCode, Cohort, CohortStudent } = require('../db/models')
const { jwtEncode, jwtDecode } = require('../util/jwt')
const { sendMail } = require('../util/email')
const { emailVerificationTemplate, cohortAccountOpenedTemplate } = require('../util/emailTemplates')
const { notifyUser } = require('./services/notification.service')
const logger = require('../util/logger')
const { errorHandler } = require('./api_util/api_util')
const { updateCounts } = require('./api_util/cohorts')
const { v, Joi } = require('./api_util/validator')
const { generatePasswordHash, validatePasswordHash } = require('./api_util/authentication')
const { checkAccountValid } = require('../api/api_util/registrationCode')
const ModelProvider = require('./providers/model.provider')

const VERIFY_TOKEN_TTL_HOURS = 24

const registrationValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).max(60).required(),
    registrationCode: Joi.string().required(),
    legalName: Joi.string().required(),
    nickName: Joi.string(),
    language: Joi.string(),
  }),
}
router.post('/user/create', v(registrationValidation), async function (req, res) {
  let createdUserId = null
  let verifyToken = null
  let createdUserEmail = null
  let createdUserName = null
  let createdCohortName = null

  await sequelize.transaction(async (transaction) => {
    let hash = await generatePasswordHash(req.body.password)

    let registrationCode = await RegistrationCode.findOne({
      where: { code: req.body.registrationCode },
      include: [
        {
          model: Cohort,
          as: 'cohort',
        },
      ],
    })

    if (!registrationCode) {
      return errorHandler(res, { error_description: 'Invalid registration code' })
    }
    const { used, status, expirationDate } = registrationCode
    const codeExpired = moment(expirationDate).toDate() < moment()
    const codeDisabled = status === 'disabled'

    if (used) {
      return errorHandler(res, { error_description: 'Registration code has been used' })
    } else if (codeExpired) {
      return errorHandler(res, { error_description: 'Registration code has expired' })
    } else if (codeDisabled) {
      return errorHandler(res, { error_description: 'Registration code disabled' })
    }

    let existingUser = await ModelProvider.findUserInfomationByEmail(req.body.email)
    if (existingUser) {
      return errorHandler(res, { error_description: 'Email already in use' })
    }

    verifyToken = uuidv4()
    const emailVerifyTokenExpiresAt = moment().add(VERIFY_TOKEN_TTL_HOURS, 'hours').toDate()

    let user = await User.create(
      {
        nickName: req.body.nickName,
        legalName: req.body.legalName,
        email: req.body.email,
        passHash: hash,
        isAdmin: false,
        vendorStylePreference: 'siemens',
        sliceFrameRate: 'Medium',
        language: req.body.language,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyTokenExpiresAt,
      },
      { transaction }
    )

    await CohortStudent.create(
      {
        cohortId: registrationCode.cohort.id,
        userId: user.id,
        registrationCodeId: registrationCode.id,
        settingsFromManager: {},
      },
      { transaction }
    )

    const modelProvider = await ModelProvider.getModelProviderFromCohortId(registrationCode.cohort.id)
    await modelProvider.UserInformation.create(
      {
        userId: user.id,
        nickName: req.body.nickName,
        legalName: req.body.legalName,
        email: req.body.email,
        passHash: hash,
        isAdmin: false,
        vendorStylePreference: 'siemens',
        sliceFrameRate: 'Medium',
        language: req.body.language,
      },
      { transaction }
    )

    await updateCounts(registrationCode.cohort, transaction)
    await registrationCode.update({ used: true, activationDate: new Date(), userId: user.id }, { transaction })

    createdUserId = user.id
    createdUserEmail = req.body.email
    createdUserName = req.body.nickName || req.body.legalName
    createdCohortName = registrationCode.cohort.name
  })

  if (createdUserId) {
    const origin = req.get('origin') || ''

    // Verification email — sent directly (bypasses emailVerified guard intentionally)
    const verificationLink = `${origin}/verify-email?token=${verifyToken}`
    const verifyTemplate = emailVerificationTemplate(createdUserName, verificationLink)
    sendMail({ to: createdUserEmail, ...verifyTemplate }).catch((err) =>
      logger.error(`[verifyEmail] Failed to send verification email to user ${createdUserId}: ${err.message}`)
    )

    // In-app: account created
    notifyUser(createdUserId, 'ACCOUNT_CREATED', {
      title: 'Welcome to ScanLab',
      message: `Your account has been created. Please verify your email to get started.`,
    }).catch((err) => logger.error(`[ACCOUNT_CREATED] notify failed for user ${createdUserId}: ${err.message}`))

    // In-app + email: cohort account opened (email only once verified)
    const { subject: cohortSubject, html: cohortHtml } = cohortAccountOpenedTemplate(createdCohortName, origin || 'https://app.scanlabmr.com')
    notifyUser(createdUserId, 'COHORT_ACCOUNT_OPENED', {
      title: `Your ${createdCohortName} account is ready`,
      message: `Your ScanLab account for ${createdCohortName} is now open.`,
      emailSubject: cohortSubject,
      emailHtml: cohortHtml,
    }).catch((err) => logger.error(`[COHORT_ACCOUNT_OPENED] notify failed for user ${createdUserId}: ${err.message}`))

    return res.json({ success: true, userID: createdUserId })
  }
  // Error paths already responded via errorHandler inside the transaction callback
})

const loginValidation = {
  body: Joi.object({
    username: Joi.string() // TODO: remove when not needed by fontend
      .email(),
    email: Joi.string().email(),
    password: Joi.string().min(1).max(60).required(),
  }),
}

router.post('/login', v(loginValidation), async function (req, res) {
  let { username, password, email } = req.body
  email = email ? email.toLowerCase() : username.toLowerCase() // TODO: remove when not needed by fontend
  try {
    let userInformation = await ModelProvider.findUserInfomationBySequelizeWhere({
      email: sequelize.where(sequelize.fn('lower', sequelize.col('email')), sequelize.fn('lower', email)),
    })

    if (!userInformation) {
      return res.status(404).json({
        error_description: `User not found`,
      })
    }

    const user = await User.findOne({
      where: { id: userInformation.userId },
      include: [
        {
          model: CohortStudent,
          as: 'cohortStudents',
          include: [
            {
              as: 'registrationCode',
              model: RegistrationCode,
              attributes: ['status', 'numOfDaysActive', 'activationDate'],
            },
          ],
        },
      ],
    })

    if (!user) {
      res.status(404).json({
        error_description: `User not found`,
      })
    } else {
      const code = _.get(user.cohortStudents[0], 'registrationCode')
      // Original users (like Matthew, etc) do not have associated Cohorts, so consider them active unless they have an explicitly disable registrationCode
      const isActive = _.get(user.cohortStudents[0], 'registrationCode.status') !== 'disabled'

      const isNotValid = code ? checkAccountValid(code.numOfDaysActive, code.activationDate) : !isActive
      if (!isActive) {
        res.status(401)
        res.json({
          error_description: `Account disabled`,
        })
      } else if (isNotValid) {
        res.status(402).json({
          error_description: `Account no longer active. Please renew.`,
        })
      } else if (await validatePasswordHash(password, userInformation.passHash)) {
        let access_token = jwtEncode({
          user: _.pick(user, ['id']),
          generated_at: moment(),
        })
        logger.info(`Login OK ${user.id}`)
        res.json({ access_token, created_at: moment() })
      } else {
        logger.info('Login BAD', user.id)
        res.status(401)
        res.json({
          error_description: `Cannot validate password`,
        })
      }
    }
  } catch (e) {
    logger.info('Login call failed')
    logger.error(e)
    res.status(401)
    res.json({
      error_description: 'Login call failed',
    })
  }
})

function getPasswordResetURL(origin, userId) {
  const token = jwtEncode(userId, {
    expiresIn: 7200, // 2 hours
  })
  return `${origin}/reset-password/${btoa(token)}`
}
const resetPasswordTemplate = (userInformation, url, isCTLab) => {
  const to = userInformation.email
  const subject = `ScanLab${isCTLab ? 'CT' : 'MR'}™ Password Reset`
  const html = `
    <p>Hey ${userInformation.nickName || userInformation.legalName},</p>
    <p>We heard that you lost your ScanLab${isCTLab ? 'CT' : 'MR'}™ password. Sorry about that!</p>
    <p>But don't worry! You can use the following link to reset your password:</p>
    <a href="${url}">${url}</a>
    <p>This link expires in 2 hours.</p>
    `

  return { to, subject, html }
}

router.post('/sendPasswordReset', async function (req, res) {
  const { email, isCTLab } = req.body
  const origin = req.get('origin') || ''
  let userInformation = await ModelProvider.findUserInfomationBySequelizeWhere({
    email: sequelize.where(sequelize.fn('lower', sequelize.col('email')), sequelize.fn('lower', email)),
  })
  if (!userInformation) {
    return errorHandler(res, { error_description: 'No user with that email' })
  }
  let user = await User.findOne({
    where: { id: userInformation.userId },
  })

  if (!user) {
    return errorHandler(res, { error_description: 'No user with that email' })
  }

  const url = getPasswordResetURL(origin, user.id)
  const emailTemplate = resetPasswordTemplate(userInformation, url, isCTLab)
  const result = await sendMail(emailTemplate)

  res.json({ success: result })
})

router.post('/recievePasswordReset/:token', async function (req, res) {
  const { token } = req.params
  const { password } = req.body

  // verify jwt is valid
  let payload

  try {
    payload = jwtDecode(token)
  } catch (e) {
    console.log('jwtDecode error', e)
  }

  if (!payload) {
    return errorHandler(res, { error_description: 'Invalid token' })
  }

  let user = await User.findByPk(payload)

  if (!user) {
    return errorHandler(res, { error_description: 'User not found' })
  }

  const userInformation = await ModelProvider.findUserInfomationBySequelizeWhere({
    userId: user.id,
  })
  if (!userInformation) {
    return errorHandler(res, { error_description: 'User information not found' })
  }
  if (userInformation) {
    userInformation.passHash = await generatePasswordHash(password)

    await userInformation.save()
  }

  res.json({ success: true })
})

router.get('/verifyEmail', async function (req, res) {
  const { token } = req.query

  if (!token) {
    return res.status(400).json({ success: false, error_description: 'Token required' })
  }

  const user = await User.findOne({
    where: {
      emailVerifyToken: token,
      emailVerifyTokenExpiresAt: { [Op.gt]: new Date() },
    },
  })

  if (!user) {
    return res.status(400).json({ success: false, error_description: 'Invalid or expired verification token' })
  }

  await user.update({
    emailVerified: true,
    emailVerifyToken: null,
    emailVerifyTokenExpiresAt: null,
  })

  logger.info(`[verifyEmail] User ${user.id} verified their email`)

  // Now that email is verified, send the cohort welcome email that was skipped at registration
  setImmediate(async () => {
    try {
      const cohortStudent = await CohortStudent.findOne({ where: { userId: user.id } })
      if (cohortStudent) {
        const cohort = await Cohort.findByPk(cohortStudent.cohortId)
        const cohortName = cohort?.name || 'ScanLab'
        const origin = req.get('origin') || process.env.APP_BASE_URL || 'https://app.scanlabmr.com'
        const { subject, html } = cohortAccountOpenedTemplate(cohortName, origin)
        await sendMail({ to: user.email, subject, html })
      }
    } catch (err) {
      logger.error(`[verifyEmail] Failed to send welcome email to user ${user.id}: ${err.message}`)
    }
  })

  return res.json({ success: true })
})

module.exports = router
