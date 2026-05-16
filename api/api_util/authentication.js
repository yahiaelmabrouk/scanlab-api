const bcrypt = require('bcryptjs')

const SALTROUNDS = 10

async function generatePasswordHash(password) {
  let salt = await bcrypt.genSalt(SALTROUNDS) // Generate a salt
  return await bcrypt.hash(password, salt) // Hash (encrypt) our password using the salt
}

async function validatePasswordHash(password, hash) {
  return await bcrypt.compare(password, hash)
}

module.exports = {
  generatePasswordHash,
  validatePasswordHash,
}
