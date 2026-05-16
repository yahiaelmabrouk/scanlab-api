const logger = require('./logger')

const SERIALIZATION_ERROR_CODE = '40001'

/**
 * Retries an async function when PostgreSQL throws a serialization error
 * (code 40001 — "could not serialize access due to concurrent update").
 *
 * This is especially common with FDW (Foreign Data Wrapper) writes, which
 * default to REPEATABLE READ isolation on the remote side.
 *
 * @param {Function} fn       – async function to execute
 * @param {object}   [opts]
 * @param {number}   [opts.maxRetries=3]  – total retry attempts (not counting the first)
 * @param {number}   [opts.baseDelay=50]  – initial delay in ms (doubled each retry)
 * @param {string}   [opts.label]         – label for log messages
 */
async function retryOnSerializationError(fn, { maxRetries = 3, baseDelay = 50, label = '' } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const code = err.parent?.code || err.original?.code || err.code
      if (code === SERIALIZATION_ERROR_CODE && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        logger.warn(
          `[RetrySerializable] ${label || 'operation'} hit serialization conflict (attempt ${
            attempt + 1
          }/${maxRetries}), retrying in ${delay}ms`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
}

module.exports = { retryOnSerializationError }
