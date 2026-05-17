const logger = require('./logger')

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

if (!client) {
  logger.warn('[sms] Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing) — SMS sends will be logged to stdout only')
}

async function sendSms(to, body) {
  if (client) {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    })
    logger.info(`SMS sent: ${message.sid}`)
    return true
  } else {
    console.log({ sms: { to, body } })
    return true
  }
}

module.exports = { sendSms }
