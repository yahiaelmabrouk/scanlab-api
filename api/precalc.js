const prisma = require('../db/prisma')
const cacheHelper = require('./cacheHelper')
const { recalcUserStatistics, recalcUserTests } = require('./statsCacheHelper')
const { sequelize, UserStatsCache, Sequelize } = require('../db/models')
const { Op } = Sequelize
const _ = require('lodash')
const logger = require('../util/logger')
const TWO_HOURS = 2 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const StatisticService = require('./services/statistic.service')
const { queryWithTimeout } = require('../util/sql')
const { getCohortArea } = require('./api_util/api_util')

// ========================================================================
// MEMORY SAFETY GUARDS - Prevent R14 memory quota exceeded errors
// ========================================================================
const MEMORY_CEILING_MB = 600 // Abort if memory exceeds this (Heroku limit is 1024 MB)
const MAX_COHORTS = parseInt(process.env.MAX_COHORTS || '10') // Limit cohorts processed per run

function isMemoryTooHigh() {
  const usedMB = process.memoryUsage().heapUsed / 1024 / 1024
  if (usedMB > MEMORY_CEILING_MB) {
    logger.warn(`[precalc] Memory too high: ${usedMB.toFixed(0)} MB (limit ${MEMORY_CEILING_MB} MB). Aborting.`)
    return true
  }
  return false
}

async function breathe(ms = 2000) {
  // Give GC a chance to collect between heavy operations
  await new Promise((resolve) => setTimeout(resolve, ms))
  if (global.gc) global.gc()
}

async function processAngleData(data) {
  const getAngleValue = (dataItem) => dataItem.sliceQuantAngleOff
  const basicFiltered = _.chain(data).filter((d) => _.isNumber(getAngleValue(d)))
  // Collapse multi-slice-group rows into one averaged value per stack question, then mean.
  const perQuestion = _(basicFiltered.value())
    .groupBy((r) => `${r.questionSetResultId}|${r.questionOrder}`)
    .map((groupEntries) => Math.round(_.meanBy(groupEntries, getAngleValue)))
    .value()
  return { mean: _.mean(perQuestion), count: perQuestion.length }
}

// Calculate wasted slices and raw wasted coverage (mm) from a single expanded row.
// Coverage comes from the slice prescription score only (sliceQuantScores); the
// parameter-score groupScoreVariables is not a valid fallback because it can hold
// coverage values for questions that aren't graded on slice coverage.
function calculateCoverage(entry) {
  const answerData = entry.answer && entry.answer[0]
  if (!answerData) return { slices: 0, coverage: 0 }
  const sliceSize = answerData.spacing + answerData.thickness
  if (sliceSize === 0) return { slices: 0, coverage: 0 }

  const lowCoverage = entry.sliceCoverageZTooLow
  const highCoverage = entry.sliceCoverageZTooHigh

  const coverage = highCoverage > lowCoverage ? highCoverage : -1 * lowCoverage
  return { slices: coverage / sliceSize, coverage }
}

async function processCohortInChunks(cohortId, chunkSize = 50, setLastUsedNull = false) {
  const totalStudents = await prisma.cohortStudent.count({ where: { cohortId } })
  const cohortArea = await getCohortArea(cohortId)
  let angleSum = 0,
    angleCount = 0
  let wastedSum = 0,
    wastedCount = 0
  let coverageSum = 0,
    coverageCount = 0

  for (let offset = 0; offset < totalStudents; offset += chunkSize) {
    const students = await prisma.cohortStudent.findMany({
      where: { cohortId },
      select: { userId: true },
      skip: offset,
      take: chunkSize,
    })
    const userIds = students.map((s) => s.userId)
    if (userIds.length === 0) continue

    // SINGLE combined query for both angle + wasted slices data (60s timeout for background work)
    const combinedSql = StatisticService.getCombinedAngleAndWastedSlicesOfMultiUserSql({ userId: userIds }, undefined, {
      region: cohortArea,
    })
    let rawData = await queryWithTimeout(
      sequelize,
      combinedSql,
      {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      },
      60000
    )

    // Expand once - both angle and wasted slices from the same raw rows
    const angleData = StatisticService.expandAngleRows(rawData)
    const wastedData = StatisticService.expandWastedSlicesRows(rawData)
    rawData = null // free memory

    // ANGLE AVERAGE (weighted by number of questions in the chunk, not expanded rows)
    const { mean: angleMean, count: angleQuestionCount } = await processAngleData(angleData)
    if (!isNaN(angleMean) && angleQuestionCount > 0) {
      angleSum += angleMean * angleQuestionCount
      angleCount += angleQuestionCount
    }

    // WASTED SLICES + WASTED COVERAGE AVERAGES
    const wastedFiltered = _.chain(wastedData)
      .filter((d) => _.isNumber(d.sliceCoverageZTooLow) && _.isNumber(d.sliceCoverageZTooHigh))
      .value()
    const computed = wastedFiltered.map(calculateCoverage)
    const wastedMean = _.meanBy(computed, 'slices')
    const coverageMean = _.meanBy(computed, 'coverage')
    if (!isNaN(wastedMean)) {
      wastedSum += wastedMean * wastedData.length
      wastedCount += wastedData.length
    }
    if (!isNaN(coverageMean)) {
      coverageSum += coverageMean * wastedData.length
      coverageCount += wastedData.length
    }
  }

  // Calculate final means
  const safeAngleMean = angleCount ? angleSum / angleCount : null
  const safeWastedMean = wastedCount ? wastedSum / wastedCount : null
  const safeCoverageMean = coverageCount ? coverageSum / coverageCount : null
  await cacheHelper.updateCohortCache(cohortId, safeAngleMean, safeWastedMean, safeCoverageMean)
  if (setLastUsedNull) {
    await prisma.cohortAverageCache.update({
      where: { cohortId: Number(cohortId) },
      data: { lastUsed: null },
    })
  }
}

async function precalcAllCohorts() {
  const now = new Date()
  const cohorts = await prisma.cohort.findMany({ select: { id: true } })

  for (const cohort of cohorts) {
    const studentCount = await prisma.cohortStudent.count({ where: { cohortId: cohort.id } })
    if (studentCount <= 50) continue

    const cache = await cacheHelper.getCohortCache(cohort.id)
    let shouldRecalculate = false

    if (!cache) {
      shouldRecalculate = true
    } else {
      const lastUpdatedAt = cache.lastUpdatedAt ? new Date(cache.lastUpdatedAt) : null
      const lastUsed = cache.lastUsed ? new Date(cache.lastUsed) : null
      const updatedAgo = lastUpdatedAt ? now - lastUpdatedAt : Infinity
      const usedAgo = lastUsed ? now - lastUsed : Infinity

      if ((updatedAgo > TWO_HOURS && usedAgo <= THIRTY_DAYS) || !lastUpdatedAt || !lastUsed) {
        shouldRecalculate = true
      }
      // else: skip (fresh or stale and unused)
    }

    if (shouldRecalculate) {
      // Calculate averages in batches of 10 students
      await processCohortInChunks(cohort.id, 10, true)
      // processCohortInChunks should call updateCohortCache, which sets lastUsed and lastUpdatedAt
    }
  }
}

// Precompute per-user heavy payloads for cohorts > 50 users.
// coldStart=true  => force-build for ALL users in cohort (fill missing caches).
// coldStart=false => only refresh "hot but stale" users in that cohort.
//
// includeChallengeMode=false is the common case. we can call again with true if we want to warm that path too.
async function processUserStatsForCohortInChunks(
  cohortId,
  chunkSize = 25,
  includeChallengeMode = false,
  coldStart = false
) {
  const totalStudents = await prisma.cohortStudent.count({ where: { cohortId } })
  const now = new Date()

  for (let offset = 0; offset < totalStudents; offset += chunkSize) {
    const students = await prisma.cohortStudent.findMany({
      where: { cohortId },
      select: { userId: true },
      skip: offset,
      take: chunkSize,
    })
    const userIds = students.map((s) => s.userId)
    if (!userIds.length) continue

    // Pull all existing cache rows for these users (could be 0 rows for coldStart)
    const rows = await UserStatsCache.findAll({
      where: {
        userId: { [Op.in]: userIds },
        includeChallengeMode,
        cacheType: { [Op.in]: ['statistics', 'tests_whom'] },
      },
    })

    // index what we already have in cache
    const rowsByUser = _.groupBy(rows, 'userId')

    // Decide who/what to refresh
    const needsStats = new Set()
    const needsTests = new Set()

    for (const uid of userIds) {
      const userRows = rowsByUser[uid] || []

      if (coldStart) {
        // For cold start: only enqueue if that specific cacheType has no cache row
        const statsRow = userRows.find((r) => r.cacheType === 'statistics')
        const testsRow = userRows.find((r) => r.cacheType === 'tests_whom')

        // helper to check "stale"
        const isStale = (row) => {
          if (!row) return true // no row = definitely needs calc
          return false
        }

        if (isStale(statsRow)) {
          needsStats.add(uid)
        }

        if (isStale(testsRow)) {
          needsTests.add(uid)
        }

        continue
      }

      // Normal periodic pass (non-coldStart)
      for (const cacheRow of userRows) {
        const lastUsed = cacheRow.lastUsed ? new Date(cacheRow.lastUsed) : null
        const lastUpdatedAt = cacheRow.lastUpdatedAt ? new Date(cacheRow.lastUpdatedAt) : null
        const usedAgo = lastUsed ? now - lastUsed : Infinity
        const updatedAgo = lastUpdatedAt ? now - lastUpdatedAt : Infinity

        // "hot but stale": user looked at this data in the last 30 days,
        const hotButStale = usedAgo <= THIRTY_DAYS

        if (hotButStale) {
          if (cacheRow.cacheType === 'statistics') needsStats.add(uid)
          if (cacheRow.cacheType === 'tests_whom') needsTests.add(uid)
        }
      }
    }

    // Actually (re)build
    for (const uid of needsStats) {
      await recalcUserStatistics(uid, includeChallengeMode)
    }
    for (const uid of needsTests) {
      await recalcUserTests(uid, includeChallengeMode)
    }
  }
}

// Iterate cohorts (>10 students) and precompute user stats where appropriate.
// coldStart=true  => full warm of everyone in those big cohorts
// coldStart=false => just refresh hot-but-stale
async function precalcAllLargeCohortUserStats(coldStart = false) {
  logger.info(`[precalcAllLargeCohortUserStats] Starting (coldStart=${coldStart})`)
  const cohorts = await prisma.$queryRaw`
    SELECT c.id, cs_counts.student_count AS "studentCount"
    FROM "Cohorts" c
    INNER JOIN (
      SELECT "cohortId", COUNT(*)::int AS student_count
      FROM "CohortStudents"
      GROUP BY "cohortId"
      HAVING COUNT(*) > 10
    ) cs_counts ON cs_counts."cohortId" = c.id
    LEFT JOIN "CohortAverageCache" cac ON cac."cohortId" = c.id
    ORDER BY
      cac."lastUsed" IS NULL,
      cac."lastUsed" DESC NULLS LAST,
      cs_counts.student_count DESC
  `
  logger.info(`[precalcAllLargeCohortUserStats] Found ${cohorts.length} qualifying cohorts`)

  let processedCount = 0
  const maxCohorts = coldStart ? MAX_COHORTS : cohorts.length // Limit only on cold-start

  for (const cohort of cohorts) {
    // Memory guard: abort if approaching quota
    if (isMemoryTooHigh()) {
      logger.warn(`[precalcAllLargeCohortUserStats] Memory ceiling reached. Processed ${processedCount} cohorts.`)
      break
    }

    // Limit cohorts on cold-start to prevent memory exhaustion
    if (coldStart && processedCount >= maxCohorts) {
      logger.info(`[precalcAllLargeCohortUserStats] Reached MAX_COHORTS limit (${maxCohorts}). Stopping.`)
      break
    }

    logger.info(`[precalcAllLargeCohortUserStats] Processing cohort ${cohort.id} (${cohort.studentCount} students)`)

    // Warm/refresh includeChallengeMode = false first (most common path)
    await processUserStatsForCohortInChunks(cohort.id, 25, false, coldStart)

    // Memory guard after each cohort
    if (isMemoryTooHigh()) {
      logger.warn(`[precalcAllLargeCohortUserStats] Memory ceiling reached after cohort ${cohort.id}`)
      break
    }

    // If we also want includeChallengeMode=true hot:
    await processUserStatsForCohortInChunks(cohort.id, 25, true, coldStart)

    processedCount++

    // Breathing delay between cohorts to allow GC
    await breathe(2000)
  }

  logger.info(`[precalcAllLargeCohortUserStats] Completed. Processed ${processedCount} cohorts.`)
}

module.exports = {
  precalcAllCohorts,
  processCohortInChunks,
  precalcAllLargeCohortUserStats,
  processUserStatsForCohortInChunks,
}
