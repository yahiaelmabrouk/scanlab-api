const logger = require('./logger')
const Sentry = require('@sentry/node')
const prisma = require('../db/prisma')
const { flushLastUsedAtNow } = require('../api/api_util/middlewareCache')

/**
 * Provides:
 *  - in-flight request counting middleware
 *  - SIGTERM/SIGINT handlers to drain, stop intervals, close server/DB
 */

function inFlightMiddleware() {
  let inFlight = 0
  return {
    middleware(req, res, next) {
      inFlight++
      res.on('finish', () => { inFlight-- })
      next()
    },
    getCount: () => inFlight,
  }
}

function registerGraceful({ server, sequelize, stopIntervals = [], stopCallbacks = [], getInFlight, drainMs = 15000 }) {
  async function shutdown(signal) {
    logger.warn(`[shutdown] ${signal} received — draining`)
    // stop accepting new connections
    if (server) {
      server.close(() => logger.info('[shutdown] HTTP server closed'))
    }

    // wait for in-flight or timeout
    const start = Date.now()
    while (getInFlight && getInFlight() > 0 && Date.now() - start < drainMs) {
      await new Promise(r => setTimeout(r, 200))
    }

    // clear repeating jobs
    for (const id of stopIntervals) {
      try { clearInterval(id) } catch { }
    }

    // clear callback-based timers (self-scheduling setTimeout chains)
    for (const cb of stopCallbacks) {
      try { cb() } catch { }
    }

    // flush batched lastUsedAt writes (uses Prisma — must run before disconnect)
    try { await flushLastUsedAtNow(); logger.info('[shutdown] lastUsedAt flushed') } catch (e) { logger.error(e) }

    // close DBs — Prisma last since flushes above depend on it
    if (sequelize) {
      try { await sequelize.close(); logger.info('[shutdown] Sequelize closed') } catch (e) { logger.error(e) }
    }
    try { await prisma.$disconnect(); logger.info('[shutdown] Prisma closed') } catch (e) { logger.error(e) }

    logger.warn('[shutdown] done')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    logger.error('[process] unhandledRejection', { json: { reason: String(reason), stack: reason?.stack } })
    Sentry.captureException(reason)
  })

  process.on('uncaughtException', (err) => {
    logger.error('[process] uncaughtException — shutting down', { json: { message: err.message, stack: err.stack } })
    Sentry.captureException(err)
    shutdown('uncaughtException')
  })
}

module.exports = { inFlightMiddleware, registerGraceful }
