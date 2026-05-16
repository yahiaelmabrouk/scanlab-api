const logger = require('./logger')

let _locked = false
let _holder = null

function tryAcquire(taskName) {
  if (_locked) {
    logger.info(`[backgroundLock] ${taskName} skipped — ${_holder} is already running`)
    return false
  }
  _locked = true
  _holder = taskName
  return true
}

function release(taskName) {
  if (_holder === taskName) {
    _locked = false
    _holder = null
  }
}

function withLock(taskName, fn) {
  return async function () {
    if (!tryAcquire(taskName)) return
    try {
      await fn()
    } finally {
      release(taskName)
    }
  }
}

module.exports = { tryAcquire, release, withLock }
