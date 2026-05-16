function isProduction() {
  if (process.env.NODE_ENV === 'production') {
    return true
  } else {
    return false
  }
}

module.exports = {
  isProduction,
}
