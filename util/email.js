const nodemailer = require('nodemailer')
const sgTransport = require('nodemailer-sendgrid-transport')
const _ = require('lodash')
const logger = require('../util/logger')

const client = process.env.SENDGRID_APIKEY
  ? nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: process.env.SENDGRID_APIKEY,
        },
      })
    )
  : null

if (!client) {
  logger.warn('[email] SendGrid not configured (SENDGRID_APIKEY missing) — emails will be logged to stdout only')
}

async function sendMail(email) {
  if (client) {
    const result = await client.sendMail(_.extend(email, { from: 'questions@scanlabmr.com' }))
    logger.info(result)
    return result.message === 'success'
  } else {
    console.log(email)
    return true
  }
}

module.exports = {
  sendMail,
}
