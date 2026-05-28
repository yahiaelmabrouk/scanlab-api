require('dotenv-defaults/config')
const logger = require('./util/logger')
const bodyParser = require('body-parser')
const moment = require('moment/moment')
const express = require('express')
require('express-async-errors')
const cors = require('cors')
const compression = require('compression')
const app = express()
const apiRouter = require('./api/api')
const db = require(__dirname + '/db/models')
const Sentry = require('@sentry/node')
const { ValidationError } = require('express-validation')
const { isProduction } = require('./util/environment')
const { mountS3Cache } = require('./api/api_util/s3Cacher')
const { precalcAllCohorts, processCohortInChunks, precalcAllLargeCohortUserStats } = require('./api/precalc')
const { withLock } = require('./util/backgroundLock')
const { stopRefreshTimer, flushLastUsedNow } = require('./api/cacheHelper')
const { runAccountExpiryScan } = require('./api/services/notificationEvents')

const healthRoutes = require('./health/healthRoutes')
const { inFlightMiddleware, registerGraceful } = require('./util/graceful')

const ONE_HOUR = 60 * 60 * 1000
const TWO_HOURS = 2 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

let periodicStartTimer = null // initial 1-hour delay timeout
let periodicTimer = null // repeating 2-hour interval (set after first run)
let weeklyTimer = null
let dailyTimer = null

// Only web.1 runs background jobs to avoid redundant DB work across dynos.
// Defaults to 'web.1' so jobs still run in local development (where DYNO is undefined).
const isSchedulerDyno = (process.env.DYNO || 'web.1') === 'web.1'

function runInBackground(taskName, task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      logger.error(`[Background] ${taskName} failed`, error)
    })
}

async function periodicCohortCacheRefresh() {
  const now = new Date()
  // Use Sequelize to fetch all caches
  const caches = await db.CohortAverageCache.findAll()
  for (const cache of caches) {
    const cohortId = cache.cohortId
    const lastUsed = cache.lastUsed ? new Date(cache.lastUsed) : null
    const lastUpdatedAt = cache.lastUpdatedAt ? new Date(cache.lastUpdatedAt) : null
    const usedAgo = lastUsed ? now - lastUsed : Infinity
    const updatedAgo = lastUpdatedAt ? now - lastUpdatedAt : Infinity

    // Only refresh if lastUsed within 30 days and lastUpdatedAt older than 2 hours
    if (usedAgo <= THIRTY_DAYS && updatedAgo > TWO_HOURS) {
      // Check student count
      const studentCount = await db.CohortStudent.count({ where: { cohortId } })
      if (studentCount > 50) {
        logger.info(`[PeriodicRefresh] Refreshing cohort ${cohortId} (students: ${studentCount})`)
        await processCohortInChunks(cohortId, 10)
      }
    }
  }
  logger.info(`[PeriodicRefresh] Completed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
}

// ---- weekly scheduler (runs task every week on given weekday+time, server's local TZ) ----
// dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday
function scheduleWeeklyAt(dayOfWeek, timeHHmm, task) {
  const [H, M] = (timeHHmm || '23:00').split(':').map(Number)

  async function runAndReschedule() {
    try {
      logger.info(`[Scheduler] Running weekly task @ ${new Date().toISOString()}`)
      await task()
      logger.info('[Scheduler] Weekly task finished')
    } catch (e) {
      logger.error('[Scheduler] Weekly task failed', e)
    } finally {
      planNext()
    }
  }

  function planNext() {
    const now = new Date()
    const next = new Date(now)

    // set clock portion first
    next.setHours(H, M, 0, 0)

    // set to the desired weekday THIS week
    // JS getDay(): 0=Sun .. 6=Sat
    const currentDow = now.getDay()

    let deltaDays = dayOfWeek - currentDow
    if (deltaDays < 0) {
      // desired day already passed this week -> go to next week
      deltaDays += 7
    }

    // if today *is* the day but time already passed, also push one week
    if (deltaDays === 0 && next <= now) {
      deltaDays = 7
    }

    // move `next` forward deltaDays
    next.setDate(next.getDate() + deltaDays)

    const delay = next - now
    logger.info(`[Scheduler] Next weekly run scheduled at ${next.toISOString()} (in ${(delay / 60000).toFixed(1)} min)`)

    // store the timer so we can clear it on shutdown
    weeklyTimer = setTimeout(runAndReschedule, delay)
  }

  // kick off initial schedule
  planNext()
}

// ---- daily scheduler (runs task every day at given time, server's local TZ) ----
function scheduleDailyAt(timeHHmm, task) {
  const [H, M] = (timeHHmm || '08:00').split(':').map(Number)

  async function runAndReschedule() {
    try {
      logger.info(`[Scheduler] Running daily task @ ${new Date().toISOString()}`)
      await task()
      logger.info('[Scheduler] Daily task finished')
    } catch (e) {
      logger.error('[Scheduler] Daily task failed', e)
    } finally {
      planNext()
    }
  }

  function planNext() {
    const now = new Date()
    const next = new Date(now)
    next.setHours(H, M, 0, 0)
    // if today's time already passed, run tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    const delay = next - now
    logger.info(`[Scheduler] Next daily run scheduled at ${next.toISOString()} (in ${(delay / 60000).toFixed(1)} min)`)
    dailyTimer = setTimeout(runAndReschedule, delay)
  }

  planNext()
}

// --- app locals used by /readyz ---
app.locals.appReady = false
app.locals.sequelize = db.sequelize

// --- in-flight requests tracking (for graceful drains) ---
const inFlight = inFlightMiddleware()
app.use(inFlight.middleware)

// --- liveness/readiness must be mounted first & be super light ---
app.use(healthRoutes)

// // Measure Response time, cup and ram usage of each API endpoint
// const { performance } = require('perf_hooks');

// app.use(async (req, res, next) => {
//   const start = performance.now();
//   const startUsage = process.cpuUsage();

//   res.on('finish', () => {
//     const duration = performance.now() - start; // response time
//     const endUsage = process.cpuUsage(startUsage); // CPU usage during the request
//     const memoryUsage = process.memoryUsage().rss; // Memory usage in bytes

//     console.log('*************************************************************************')
//     console.log(`[Performance] ${req.method} ${req.originalUrl}`);
//     console.log(`  Response Time: ${duration.toFixed(2)}ms`);
//     console.log(`  CPU Usage: ${endUsage.user / 1000}ms (user), ${endUsage.system / 1000}ms (system)`);
//     console.log(`  Memory Usage: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`);
//     console.log('*************************************************************************')
//   });

//   next();
// });
// // End of Meaure

// Sentry.io
if (isProduction()) {
  Sentry.init({ dsn: 'https://6ed64a39bc35451fab20abd6465edb46@o390253.ingest.sentry.io/5232818' })

  // The request handler must be the first middleware on the app
  // https://docs.sentry.io/platforms/node/express/
  app.use(
    Sentry.Handlers.requestHandler({
      ip: true,
    }),
  )
}

const port = process.env.PORT || 6200

// middleware that is specific to this router
app.use(function timeLog(req, res, next) {
  logger.info(
    `[Request] ${moment().format('DD/MMM/YYYY HH:mm:ss')} ${req.socket.remoteAddress} ${req.method} ${
      req.originalUrl
    }`,
  )
  next()
})

app.use(compression({
  filter: (req, res) => {
    // Skip compression for s3cache — binary files must not be gzipped
    if (req.url.startsWith('/s3cache')) return false
    return compression.filter(req, res)
  },
}))
app.use(express.json({ limit: '20mb' }))
app.use(express.text({ type: 'text/plain', limit: '20mb' }))
app.use(express.urlencoded({ extended: true, limit: '20mb' }))

// Allow Cross Site requests if source domain is whitelisted
//https://expressjs.com/en/resources/middleware/cors.html
const whitelist = [
  '127.0.0.1',
  'localhost',
  'scanlabmr.com',
  'www.scanlabmr.com',
  'app.scanlabmr.com',
  'www.scanlabvetmr.com',
  'app.scanlabvetmr.com',
  'scanlabct.com',
  'www.scanlabct.com',
  'app.scanlabct.com',
  'scanlab-web.pages.dev',
]
// Allow the preview deploy URLs to access the API
const whitelistRegexNetlify = /^https:\/\/deploy-preview-[0-9]+--scanlab-web.netlify.app$/i

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      // CORS OK
      callback(null, true)
    } else {
      try {
        let hostname = new URL(origin).hostname
        if (
          whitelist.indexOf(hostname) !== -1 ||
          whitelistRegexNetlify.test(origin) ||
          hostname.endsWith('.scanlab-web.pages.dev')
        ) {
          // CORS OK
          callback(null, true)
        } else {
          // Throw an error to ensure this request isn't actually run
          callback(new Error(`Not allowed by CORS: [${origin}]`))
        }
      } catch (error) {
        callback(new Error(`Invalid origin: [${origin}]`))
      }
    }
  },
}
app.use(cors(corsOptions))

// Detect double res.json() calls (ERR_HTTP_HEADERS_SENT diagnosis)
app.use((req, res, next) => {
  const origJson = res.json.bind(res)
  let sent = false
  res.json = (body) => {
    if (sent)
      logger.error('[doubleSend] res.json called twice', {
        json: { method: req.method, url: req.originalUrl, stack: new Error().stack },
      })
    sent = true
    return origJson(body)
  }
  next()
})

app.use('/v1', apiRouter)

mountS3Cache(app)

// Sentry.io error handlers
if (isProduction()) {
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler())
}

app.use(function (err, req, res, next) {
  if (res.headersSent) {
    logger.error('[errorMiddleware] Error after headers sent — socket will be destroyed', {
      json: { method: req.method, url: req.originalUrl, error: err.message, stack: err.stack },
    })
    Sentry.captureException(err)
    return next(err)
  }
  let returnObj = { success: false }

  if (err instanceof ValidationError) {
    res.status(200)
    returnObj.error = err
  } else {
    res.status(500)
    if (isProduction()) {
      // errors in production will get sent to sentry, no need to log it
      returnObj.sentry = res.sentry
    } else {
      console.error(err)
      returnObj.error = err.toString()
    }
  }

  return res.json(returnObj)
})

app.use('/public', express.static('public'))

async function connectAndStart() {
  try {
    logger.info('Connecting to database...')
    await db.sequelize.authenticate()
    logger.info('Connected to database.')
    const server = app.listen(port, () =>
      logger.info(`[${process.env.NODE_ENV ?? 'development'}] Scanlab API listening on port ${port}`),
    )
    logger.info(`[Boot] DYNO=${process.env.DYNO || 'not set'}, isSchedulerDyno=${isSchedulerDyno}`)

    // kick off background jobs // Commeting out to avoid idle work with daily restart
    // runInBackground('precalcAllCohorts', precalcAllCohorts)

    if (isSchedulerDyno) {
      const guardedPeriodicRefresh = withLock('periodicCohortCacheRefresh', periodicCohortCacheRefresh)

      // Stagger by 1 hour so this fires at T+1h, T+3h, T+5h...
      // while refreshInMemoryCache (cacheHelper.js) fires at T+0, T+2h, T+4h...
      periodicStartTimer = setTimeout(() => {
        runInBackground('periodicCohortCacheRefresh', guardedPeriodicRefresh)
        periodicTimer = setInterval(
          () => runInBackground('periodicCohortCacheRefresh', guardedPeriodicRefresh),
          TWO_HOURS,
        )
      }, ONE_HOUR)

      // On boot: full warm for users in large cohorts
      // Delayed by 30s to let the server finish startup and serve requests first.
      setTimeout(() => {
        runInBackground(
          'precalcAllLargeCohortUserStats (warm)',
          withLock('precalcAllLargeCohortUserStats', () => precalcAllLargeCohortUserStats(true)),
        )
      }, 30_000)

      // -------- Weekly cache warm (once per week) --------
      // 0 = Sunday. Time is in UTC (server local time).
      scheduleWeeklyAt(0, '09:00', withLock('precalcAllLargeCohortUserStats', () => precalcAllLargeCohortUserStats(false)))

      // -------- Daily account-expiry reminder scan --------
      // Notifies students whose account expires in exactly N days (admin-configured).
      scheduleDailyAt('08:00', withLock('accountExpiryScan', runAccountExpiryScan))
    }

    // mark ready after a short warmup so /readyz turns green only when the app is actually usable
    const startupDelay = Number(process.env.READINESS_STARTUP_DELAY_MS || 1500)
    setTimeout(() => {
      app.locals.appReady = true
    }, startupDelay)

    // graceful shutdown hooks
    registerGraceful({
      server,
      sequelize: db.sequelize,
      stopIntervals: [],
      stopCallbacks: [
        () => { clearTimeout(periodicStartTimer); clearInterval(periodicTimer) },
        () => { clearTimeout(weeklyTimer) },
        () => { clearTimeout(dailyTimer) },
        stopRefreshTimer,
        () => flushLastUsedNow().catch(() => {}),
      ],
      getInFlight: inFlight.getCount,
      drainMs: Number(process.env.DRAIN_TIMEOUT_MS || 15000),
    })
  } catch (e) {
    logger.error('Unable to connect to the database:', e)
    setTimeout(function () {
      connectAndStart()
    }, 30000)
  }
}
connectAndStart()
