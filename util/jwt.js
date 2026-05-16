const jwt = require('jwt-simple')

function jwtDecode(token) {
  return jwt.decode(token, process.env.JWT_KEY, false, 'HS512')
}

function jwtEncode(payload, options = {}) {
  return jwt.encode(payload, process.env.JWT_KEY, 'HS512', options)
}

module.exports = {
  jwtEncode,
  jwtDecode,
}
