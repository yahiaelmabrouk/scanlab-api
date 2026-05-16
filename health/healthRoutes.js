const express = require('express')
const router = express.Router()

/**
 * /healthz  : quick, always-on liveness (no dependencies)
 * /livez    : process stats (still light)
 * /readyz   : heavier checks (DB + app readiness flag)
 */

router.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() })
})

router.get('/livez', (req, res) => {
  const mem = process.memoryUsage()
  res.status(200).json({
    ok: true,
    pid: process.pid,
    rssMB: Math.round(mem.rss / 1024 / 1024),
    uptime: Math.round(process.uptime()),
  })
})

router.get('/readyz', async (req, res) => {
  try {
    // appReady flag is set by server.js after startup finishes
    const ready = req.app.locals.appReady === true
    const checks = { appReady: ready }

    // DB
    if (req.app.locals.sequelize) {
      await req.app.locals.sequelize.authenticate()
      checks.db = true
    } else {
      checks.db = false
    }

    const ok = Object.values(checks).every(Boolean)
    return res.status(ok ? 200 : 503).json({ ok, checks })
  } catch (e) {
    return res.status(503).json({ ok: false, error: e.message })
  }
})

module.exports = router
