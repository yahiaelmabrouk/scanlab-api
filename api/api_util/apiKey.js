const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 12
const API_KEY_LENGTH = 32
const PREFIX_LENGTH = 8

async function generateApiKey() {
  const prefix = crypto.randomBytes(PREFIX_LENGTH).toString('hex').substring(0, PREFIX_LENGTH)
  const secret = crypto.randomBytes(API_KEY_LENGTH).toString('hex')
  const fullKey = `slk_${prefix}_${secret}`

  if (!isValidApiKeyFormat(fullKey)) {
    throw new Error('Generated API key does not match expected format')
  }

  return {
    fullKey,
    prefix,
    hash: await hashApiKey(fullKey),
  }
}

async function hashApiKey(apiKey) {
  // Pre-hash with SHA-256 to avoid bcrypt's 72-byte limit
  const preHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const salt = await bcrypt.genSalt(SALT_ROUNDS)
  return await bcrypt.hash(preHash, salt)
}

async function validateApiKey(apiKey, hash) {
  // Pre-hash with SHA-256 to match the storage format
  const preHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  return await bcrypt.compare(preHash, hash)
}

function extractPrefixFromKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('slk_')) {
    return null
  }
  const parts = apiKey.split('_')
  return parts.length >= 3 ? parts[1] : null
}

function isValidApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false
  }

  const parts = apiKey.split('_')
  if (parts.length !== 3 || parts[0] !== 'slk') {
    return false
  }

  const prefix = parts[1]
  const secret = parts[2]

  const hexRegex = /^[a-f0-9]+$/i
  return (
    prefix.length === PREFIX_LENGTH &&
    secret.length === API_KEY_LENGTH * 2 &&
    hexRegex.test(prefix) &&
    hexRegex.test(secret)
  )
}

module.exports = {
  generateApiKey,
  hashApiKey,
  validateApiKey,
  extractPrefixFromKey,
  isValidApiKeyFormat,
  API_KEY_LENGTH,
  PREFIX_LENGTH,
}
