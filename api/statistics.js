const express = require('express')
const router = express.Router()
const _ = require('lodash')
const { fetchLoggedInUser, isManagerOrAdmin, getMineCohortArea, getCohortArea } = require('./api_util/api_util')
const { User, Sequelize, CohortStudent, sequelize } = require('../db/models')
const cacheHelper = require('./cacheHelper')
const { USER_AREA } = require('../util/constants')
const logger = require('../util/logger')
const ModelProvider = require('./providers/model.provider')
const StatisticService = require('./services/statistic.service')
const statsCacheHelper = require('./statsCacheHelper')
const { queryWithTimeout } = require('../util/sql')
const { parsePaginationParams, formatPaginatedResponse } = require('./api_util/pagination')

// Track in-flight background recalculations to avoid duplicate work
const _recalcInProgress = new Set()

// These cohorts skew the global statistics too much
// These IDs are for the production database only
// const GLOBAL_COHORTS_TO_IGNORE = [
//   // Test Cohort
//   37,
//   // Test 2022
//   130,
//   // MR Assessment - Test Cohort
//   143,
//   // MASTER TEST COHORT
//   46,
//   // Managers
//   37,
// ]

/**
Excludes all users in the cohort above or anyone is considered a manager.
This is precalculated to avoid an expensive join, probably need a better way.
Ran this query using the list above:
SELECT Distinct "Users".id from "Users"
left outer join "CohortStudents" CS on "Users".id = CS."userId"
left outer join "CohortManagers" CM on "Users".id = CM."userId"
where CS."cohortId" in (37,130,143,46,37) OR CM.id > 0;
 */
// Hard ceiling on StackQuestionResults fetched per export page.
// The outer dataSql query is already paginated (max 1000 rows); at ~50 SQRs
// per QSR that would theoretically allow 50 000 rows per request. We cap
// here to keep individual queries predictable and protect the DB.
const MAX_SQR_FETCH_LIMIT = 10_000

const GLOBAL_USERS_TO_IGNORE = [
  7, 9, 10, 12, 13, 15, 17, 42, 43, 44, 63, 74, 75, 79, 82, 85, 87, 109, 110, 114, 168, 169, 178, 183, 198, 204, 205,
  227, 242, 276, 284, 285, 307, 308, 309, 363, 436, 473, 511, 512, 514, 515, 517, 518, 534, 539, 540, 559, 565, 607,
  616, 619, 630, 643, 645, 646, 658, 659, 660, 679, 695, 699, 1215, 1217, 1218, 1220, 1221, 1231, 1243, 1257, 1261,
  1275, 1276, 1284, 1289, 1290, 1312, 1318, 1319, 1321,
]

const Op = Sequelize.Op

/**
 * Resolve the DB region ('us_east' | 'eu_west' | undefined) for a "whom" string so
 * that generateCombinedQuery only scans the relevant schema instead of UNION ALL-ing
 * both schemas on every query.
 *
 * Returns undefined for multi-user or 'everyone' queries where data may span both
 * schemas — the safe fallback is always to query both.
 */
async function resolveRegionFromWhom(whom) {
  if (!whom) return undefined
  if (whom.startsWith('user_')) {
    // Only optimise single-user requests — comma-separated multi-user queries
    // may contain users from different schemas
    const parts = whom.split(',')
    if (parts.length === 1) {
      const userId = parts[0].split('_')[1]
      if (userId) return await getMineCohortArea(userId)
    }
    return undefined
  }
  if (whom.startsWith('cohort_')) {
    const cohortId = whom.split('_')[1]
    if (cohortId) return await getCohortArea(cohortId)
  }
  // 'everyone' or unknown — both schemas are needed
  return undefined
}

async function whomFilter(where, whom) {
  if (whom === 'everyone') {
    where.id = {
      [Op.notIn]: GLOBAL_USERS_TO_IGNORE,
    }
  } else if (whom.startsWith('cohort_')) {
    let [, cohortId] = whom.split('_')

    let students = await CohortStudent.findAll({
      attributes: ['userId'],
      where: { cohortId },
    })

    where.id = students.map((student) => student.userId)
  } else if (whom.startsWith('user_')) {
    const userIds = whom.split(',').map((id) => id.split('_')?.[1])
    where.id = {
      [Op.in]: userIds,
    }
  }
}

function findMCAverageParams(where) {
  const rawSql = StatisticService.getMCAverageSql(where)

  return rawSql
}

// General Statistic of a user, currently used for frontend data exporting
router.get('/statistics/export-data/:whom', fetchLoggedInUser, async function (req, res) {
  // Authorization: managers/admins may export any scope; regular users may only export their own data
  const whom = req.params.whom
  const managerOrAdmin = await isManagerOrAdmin(req.session.user)
  if (!managerOrAdmin) {
    const singleUserMatch = whom.match(/^user_(\d+)$/)
    if (!singleUserMatch || String(singleUserMatch[1]) !== String(req.session.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
  }

  try {
    let where = {}
    await whomFilter(where, whom)

    const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
    const region = await resolveRegionFromWhom(whom)
    const dataSql = StatisticService.getExportDataSql(where, pagination, { region })

    let data = await queryWithTimeout(
      sequelize,
      dataSql,
      {
        type: sequelize.QueryTypes.SELECT,
      },
      25000
    )

    const allQuestionSetResultsIdUSEasts = data
      .filter((el) => el.cohortArea == USER_AREA.US_EAST)
      .map((el) => el.questionSetResultId)

    const allQuestionSetResultsIdEUWests = data
      .filter((el) => el.cohortArea == USER_AREA.EU_WEST)
      .map((el) => el.questionSetResultId)

    // Build parallel promises — skip SQR queries when there are no matching IDs
    // to avoid sending pointless queries (and invalid empty IN clauses).
    const parallelQueries = []

    // US East SQR query
    if (allQuestionSetResultsIdUSEasts.length > 0) {
      const usEastLimit = Math.min(Math.max(allQuestionSetResultsIdUSEasts.length * 50, 1000), MAX_SQR_FETCH_LIMIT)
      const allStackQuestionResultUSEastSql = StatisticService.getQueryAllStackQuestionResultUSEastSql(
        { questionSetResultId: { [Op.in]: allQuestionSetResultsIdUSEasts } },
        usEastLimit
      )
      parallelQueries.push(
        queryWithTimeout(sequelize, allStackQuestionResultUSEastSql, { type: sequelize.QueryTypes.SELECT }, 25000)
      )
    } else {
      parallelQueries.push(Promise.resolve([]))
    }

    // EU West SQR query
    if (allQuestionSetResultsIdEUWests.length > 0) {
      const euWestLimit = Math.min(Math.max(allQuestionSetResultsIdEUWests.length * 50, 1000), MAX_SQR_FETCH_LIMIT)
      const allStackQuestionResultEUWestSql = StatisticService.getQueryAllStackQuestionResultEUWestSql(
        { questionSetResultId: { [Op.in]: allQuestionSetResultsIdEUWests } },
        euWestLimit
      )
      parallelQueries.push(
        queryWithTimeout(sequelize, allStackQuestionResultEUWestSql, { type: sequelize.QueryTypes.SELECT }, 25000)
      )
    } else {
      parallelQueries.push(Promise.resolve([]))
    }

    // Critical thinking averages — run in parallel with SQR queries
    const userId = req.params.whom.split('_')[1]
    const modelProvider = await ModelProvider.getModelProvider(userId)
    parallelQueries.push(
      modelProvider.MultipleChoiceQuestionResult.findAll({
        raw: true,
        attributes: ['testRunId', [Sequelize.fn('AVG', Sequelize.col('score')), 'scoreAvg']],
        group: ['testRunId'],
        where: { userId: userId },
      })
    )

    const [allStackQuestionResultUSEasts, allStackQuestionResultEUWests, criticalThinkingAvgRows] = await Promise.all(
      parallelQueries
    )

    const groupStackQuestionSetResultUSEasts = _.groupBy(allStackQuestionResultUSEasts, 'questionSetResultId')
    const groupStackQuestionSetResultEUWest = _.groupBy(allStackQuestionResultEUWests, 'questionSetResultId')

    data = data.map((el) => {
      el.stackQuestionResults = _.get(
        el.cohortArea == USER_AREA.EU_WEST ? groupStackQuestionSetResultEUWest : groupStackQuestionSetResultUSEasts,
        el.questionSetResultId,
        []
      )

      const allAdminComments = _.flatMap(el.stackQuestionResults, (o) => {
        return o.stackQuestionResultComments.filter((comment) => comment.commentedUserId != el.userId)
      })
      const allUserReplies = _.flatMap(el.stackQuestionResults, (o) => {
        return o.stackQuestionResultComments.filter((comment) => comment.commentedUserId == el.userId)
      })
      const isViewedAdminComment = !_.some(el.stackQuestionResults, (o) => {
        const comments = o.stackQuestionResultComments.filter((comment) => comment.commentedUserId != el.userId)
        return comments.length > 0 && comments.some((comment) => !comment.seen)
      })

      const isViewedUserReply = !_.some(el.stackQuestionResults, (o) => {
        const replies = o.stackQuestionResultComments.filter((comment) => comment.commentedUserId == el.userId)
        return replies.length > 0 && replies.some((comment) => !comment.seen)
      })

      el.isViewedAdminComment = isViewedAdminComment
      el.isViewedUserReply = isViewedUserReply
      el.isHasComment = allAdminComments.length > 0
      el.isHasReply = allUserReplies.length > 0
      return el
    })

    // Reduce critical thinking averages to a lookup object
    const criticalThinkingAvg = criticalThinkingAvgRows.reduce((acc, result) => {
      acc[result.testRunId] = result.scoreAvg
      return acc
    }, {})

    // Add avgs to question set results using test run ID
    for (let result of data) {
      result.criticalThinkingAvg = criticalThinkingAvg[result.testRunId]
    }

    res.json({ success: true, ...formatPaginatedResponse(data, pagination) })
  } catch (err) {
    const isTimeout =
      err.message?.includes('statement timeout') || err.original?.message?.includes('canceling statement')
    if (isTimeout) {
      logger.error(`[export-data] Query timed out for ${whom}`, err)
      return res.status(504).json({
        success: false,
        message: 'The data export query timed out. Please try again or contact support if the issue persists.',
      })
    }
    throw err
  }
})

// The best of a user's scores per body part
// TODO: limit to admins if whom is everyone, otherwise limit to cohort
router.get('/statistics/:whom/best', async function (req, res) {
  let where = {}
  await whomFilter(where, req.params.whom)

  const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
  const region = await resolveRegionFromWhom(req.params.whom)
  const rawDataSql = StatisticService.getStatisticBestSql(where, pagination, { region })

  let rawData = await sequelize.query(rawDataSql, {
    type: sequelize.QueryTypes.SELECT,
  })

  // want each distinct bodypart that is part of this result set
  const availableBodyParts = new Set()
  const availableBodyPartDetails = new Set()

  // reformat raw data so each record is a user with their best scores for each body part
  const newData = {}
  _.map(rawData, (value) => {
    const score = parseFloat(value.score)
    if (!isFinite(score)) return

    if (!newData[value.legalName]) {
      newData[value.legalName] = {
        name: value.legalName,
        userId: value.userId,
      }
    }
    newData[value.legalName][value.bodyPart] = !isNaN(score) && score !== null ? score.toFixed(2) : null
    availableBodyParts.add(value.bodyPart)
    availableBodyPartDetails.add({
      name: value.bodyPart,
      id: value.bodyPartId,
    })
  })
  res.json({
    success: true,
    data: _.values(newData),
    availableBodyParts: [...availableBodyParts],
    availableBodyPartDetails: [..._.unionBy([...availableBodyPartDetails], 'id')],
  })
})

router.get('/statistics', fetchLoggedInUser, async function (req, res) {
  let where = {}

  const includeChallengeMode =
    req.query.include_challenge_mode_scores === 'true' && (await isManagerOrAdmin(req.session.user))

  await whomFilter(where, req.query.whom)

  const Op = Sequelize.Op

  // figure out which userIds this request is asking for
  let userIds = []
  if (Array.isArray(where.id)) {
    // cohort_... path sets array
    userIds = where.id
  } else if (where.id && where.id[Op.in]) {
    // "user_1,user_2" path
    userIds = where.id[Op.in]
  } else if (where.id && where.id[Op.notIn]) {
    // "everyone" path
    const users = await User.findAll({
      attributes: ['id'],
      where: {
        id: {
          [Op.notIn]: where.id[Op.notIn],
        },
      },
    })
    userIds = users.map((u) => u.id)
  } else if (where.id) {
    // single user_123
    userIds = [where.id]
  }

  // did they ask for exactly ONE user_x ?
  const requestedWhomIsUsers = req.query.whom && req.query.whom.startsWith('user_')
  const requestedSingleUser = requestedWhomIsUsers && req.query.whom.split(',').length === 1

  // pull cached blobs (or recalc if stale) — batch for all users at once
  const cachedMap = await statsCacheHelper.batchGetOrRecalcUserStatistics(userIds, !!includeChallengeMode)

  // If this is a cohort request, fire-and-forget a background warm so that
  // any cold-start users (including tests_whom caches) are pre-built for the
  // next dashboard load.  This is cheap when everyone is already cached.
  if (req.query.whom && req.query.whom.startsWith('cohort_') && userIds.length > 0) {
    statsCacheHelper.warmCohortCachesInBackground(userIds, !!includeChallengeMode)
  }

  const perUserResults = {}
  let flatRows = []

  for (const uid of userIds) {
    const rows = cachedMap[uid] || []

    // Old behavior:
    // - if single user: ALWAYS return that user, even if []
    // - if multiple users: ONLY include users who actually have data
    if (rows.length > 0 || requestedSingleUser) {
      perUserResults[`user_${uid}`] = rows
      flatRows = flatRows.concat(rows) // Fixed: avoid spread operator memory spike
    }
  }

  // Old response shapes:
  // - when whom starts with "user_": object keyed by user_<id>
  // - else (cohort_..., everyone): flat array
  if (requestedWhomIsUsers) {
    return res.json({ success: true, data: perUserResults })
  } else {
    return res.json({ success: true, data: flatRows })
  }
})

// TODO "angle" will eventually be parameterizable
router.get('/statistics/factors/angle', fetchLoggedInUser, async function (req, res) {
  let where = {}

  await whomFilter(where, req.query.whom)

  if (where.id) {
    where = {
      '$questionSetResult.userId$': where.id,
    }
  }

  if (req.query.bodyPart) {
    const bodyParts = []
    if (typeof req.query.bodyPart === 'string') {
      bodyParts.push(req.query.bodyPart)
    } else {
      bodyParts.push(...req.query.bodyPart)
    }

    where['$questionSetResult->questionSet->bodyPart.name$'] = {
      [Op.in]: bodyParts,
    }
  }

  const showMean = req.query.mean === 'true'
  const showPoints = req.query.points === 'true'

  // Only cache for cohort queries
  let cohortId = null
  if (req.query.whom && req.query.whom.startsWith('cohort_')) {
    cohortId = req.query.whom.split('_')[1]
  }

  // Helper to extract angle value and round to whole number.
  // Source: slicePrescriptionScore.angleOff via expandAngleRows / getDirectAngleSql.
  const getAngleValue = (dataItem) => {
    const value = dataItem.sliceQuantAngleOff
    return value !== null && value !== undefined ? Math.round(value) : value
  }

  // Collapse rows with multiple slice groups into one averaged value per stack question.
  const perQuestionAngles = (rows) =>
    _(rows)
      .groupBy((r) => `${r.questionSetResultId}|${r.questionOrder}`)
      .map((groupEntries) => Math.round(_.meanBy(groupEntries, getAngleValue)))
      .value()

  // Helper to process angle data
  const processAngleData = (data, showMean, showPoints) => {
    const basicFiltered = _.chain(data).filter((d) => getAngleValue(d) !== null)
    return {
      mean: showMean ? _.mean(perQuestionAngles(basicFiltered.value())) : null,
      points: showPoints
        ? basicFiltered
            .groupBy('questionSetResultId')
            .map((entries) => {
              // Sort by question order to maintain exam question sequence, then collapse
              // per-slice-group rows into one averaged value per stack question.
              const sortedEntries = _.sortBy(entries, 'questionOrder')
              const individualAngles = _(sortedEntries)
                .groupBy('questionOrder')
                .map((groupEntries) => Math.round(_.meanBy(groupEntries, getAngleValue)))
                .value()
              return {
                bodyPart: entries[0].bodyPart,
                x: entries[0].createdAt.valueOf(),
                y: _.mean(individualAngles),
                individualAngles,
                preparedExamId: entries[0].preparedExamId,
                questionSetResultId: entries[0].questionSetResultId,
                userId: entries[0]['questionSetResult.userId'],
              }
            })
            .value()
        : null,
    }
  }

  // Updated cache logic for cohort averages
  if (cohortId && showMean && !showPoints) {
    const cache = await cacheHelper.getCohortCache(cohortId)
    const now = new Date()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

    if (cache && cache.lastUsed && now - new Date(cache.lastUsed) <= THIRTY_DAYS) {
      // lastUsed is recent, return cached value (lastUsed is updated in getCohortCache)
      return res.json({
        success: true,
        data: { mean: Number(cache.angleAverage), points: null },
        fromCache: true,
      })
    }

    // No cache or stale — trigger background recalculation and return stale data immediately
    // to avoid Heroku 30s HTTP timeout (processCohortInChunks can take minutes)
    if (!_recalcInProgress.has(cohortId)) {
      _recalcInProgress.add(cohortId)
      setImmediate(async () => {
        try {
          await require('./precalc').processCohortInChunks(Number(cohortId), 10)
        } catch (error) {
          logger.warn('[statistics] Background angle cache recalculation failed', error)
        } finally {
          _recalcInProgress.delete(cohortId)
        }
      })
    }
    return res.json({
      success: true,
      data: { mean: cache?.angleAverage != null ? Number(cache.angleAverage) : null, points: null },
      fromCache: true,
      recalculating: true,
    })
  }

  const region = await resolveRegionFromWhom(req.query.whom)
  const isSingleUser = req.query.whom?.startsWith('user_') && req.query.whom.split(',').length === 1

  let data
  if (isSingleUser && region) {
    // Direct SQL path — rows already expanded with scalar fields, no CTE overhead
    const userId = req.query.whom.split('_')[1]
    const bodyParts = req.query.bodyPart
      ? typeof req.query.bodyPart === 'string'
        ? [req.query.bodyPart]
        : req.query.bodyPart
      : null
    const sql = StatisticService.getDirectAngleSql(userId, region, bodyParts)
    data = await queryWithTimeout(sequelize, sql, { type: sequelize.QueryTypes.SELECT }, 30000)
  } else {
    // Existing CTE path for multi-user / cohort / everyone queries
    const sql = StatisticService.getStatisticFactorAngleSql(where, null, { region })
    data = await queryWithTimeout(sequelize, sql, { type: sequelize.QueryTypes.SELECT }, 30000)
    data = StatisticService.expandAngleRows(data)
  }

  if (req.query.whom && req.query.whom.startsWith('user_')) {
    const angleDatabyUser = _.groupBy(data, (d) => `user_${d['questionSetResult.userId']}`)
    const angleData = _.mapValues(angleDatabyUser, (userData) => processAngleData(userData, showMean, showPoints))
    return res.json({ success: true, data: angleData })
  } else {
    const result = processAngleData(data, showMean, showPoints)
    // If cohort, update cache in background
    if (cohortId && showMean && !showPoints) {
      setImmediate(async () => {
        try {
          await cacheHelper.updateCohortCache(cohortId, result.mean, null)
        } catch (error) {
          logger.warn('[statistics] Failed to update cohort angle cache', error)
        }
      })
    }
    res.json({
      success: true,
      data: result,
    })
  }
})

router.get('/statistics/derived/wastedSlices', fetchLoggedInUser, async function (req, res) {
  let where = {}

  await whomFilter(where, req.query.whom)

  if (where.id) {
    where = {
      '$questionSetResult.userId$': where.id,
    }
  }

  if (req.query.bodyPart) {
    const bodyParts = []
    if (typeof req.query.bodyPart === 'string') {
      bodyParts.push(req.query.bodyPart)
    } else {
      bodyParts.push(...req.query.bodyPart)
    }

    where['$questionSetResult->questionSet->bodyPart.name$'] = {
      [Op.in]: bodyParts,
    }
  }

  const showMean = req.query.mean === 'true'
  const showPoints = req.query.points === 'true'

  // Only cache for cohort queries
  let cohortId = null
  if (req.query.whom && req.query.whom.startsWith('cohort_')) {
    cohortId = req.query.whom.split('_')[1]
  }

  // Helper to calculate wasted slices and raw wasted coverage (mm) for an entry.
  // Coverage values come from the slice prescription score (sliceQuantScores) only —
  // the parameter-score groupScoreVariables can carry coverage values for questions
  // that aren't actually graded on slice coverage.
  const calculateCoverage = (entry) => {
    const answerData = entry.answer[0]
    const sliceSize = answerData.spacing + answerData.thickness
    if (sliceSize === 0) return { slices: 0, coverage: 0 }

    const lowCoverage = entry.sliceCoverageZTooLow
    const highCoverage = entry.sliceCoverageZTooHigh

    // Match scoring logic: check lowCoverage first (prioritize missing anatomy)
    const coverage = lowCoverage > 0 ? -1 * lowCoverage : highCoverage
    return { slices: coverage / sliceSize, coverage }
  }

  // Build a metric block (mean / individual / absoluteMean / total / absoluteTotal)
  // from a list of pre-rounded individual values.
  const buildMetricBlock = (individualValues) => {
    const absoluteValues = individualValues.map(Math.abs)
    return {
      individual: individualValues,
      mean: _.mean(individualValues),
      absoluteMean: _.mean(absoluteValues),
      total: _.sum(individualValues),
      absoluteTotal: _.sum(absoluteValues),
    }
  }

  // Helper to process wasted slices data.
  //
  // Response shape:
  //   {
  //     wastedSlices:   { mean, points: [{ ..., values: { mean, individual, absoluteMean, total, absoluteTotal } }] },
  //     wastedCoverage: { mean, points: [{ ..., values: { mean, individual, absoluteMean, total, absoluteTotal } }] },
  //   }
  //
  // wastedSlices  — coverage-error normalized by each exam's slice size (spacing + thickness).
  //                 Unit: slice count. Comparable within a modality but NOT across CT vs MR
  //                 because slice sizes differ ~3–10×. Use this for MR charts.
  // wastedCoverage — raw coverage error in millimeters (signed: negative = under-coverage,
  //                 positive = over-coverage). Unit-stable across modalities. Use this for CT charts.
  const processData = (data, showMean, showPoints) => {
    const basicFiltered = data.filter(
      (d) => _.isNumber(d.sliceCoverageZTooLow) && _.isNumber(d.sliceCoverageZTooHigh)
    )

    let slicesMean = null
    let coverageMean = null
    if (showMean) {
      const computed = basicFiltered.map((d) => {
        const { slices, coverage } = calculateCoverage(d)
        return {
          slices: Math.round(slices * 10) / 10,
          coverage: Math.round(coverage * 10) / 10,
        }
      })
      slicesMean = _.meanBy(computed, 'slices')
      coverageMean = _.meanBy(computed, 'coverage')
    }

    let slicesPoints = null
    let coveragePoints = null
    if (showPoints) {
      const grouped = _.groupBy(basicFiltered, 'questionSetResultId')
      const groupedPoints = Object.values(grouped).map((entries) => {
        const sortedEntries = _.sortBy(entries, 'questionOrder')
        // Round individual values first to avoid floating-point precision issues
        const computed = sortedEntries.map((entry) => {
          const { slices, coverage } = calculateCoverage(entry)
          return {
            slices: Math.round(slices * 10) / 10,
            coverage: Math.round(coverage * 10) / 10,
          }
        })

        const sharedMeta = {
          bodyPart: entries[0].bodyPart,
          x: entries[0].createdAt.valueOf(),
          preparedExamId: entries[0].preparedExamId,
          questionSetResultId: entries[0].questionSetResultId,
          userId: entries[0]['questionSetResult.userId'],
        }
        return {
          slices: { ...sharedMeta, values: buildMetricBlock(computed.map((c) => c.slices)) },
          coverage: { ...sharedMeta, values: buildMetricBlock(computed.map((c) => c.coverage)) },
        }
      })
      slicesPoints = groupedPoints.map((p) => p.slices)
      coveragePoints = groupedPoints.map((p) => p.coverage)
    }

    return {
      wastedSlices: { mean: slicesMean, points: slicesPoints },
      wastedCoverage: { mean: coverageMean, points: coveragePoints },
    }
  }

  // Updated cache logic for cohort averages
  if (cohortId && showMean && !showPoints) {
    const cache = await cacheHelper.getCohortCache(cohortId)
    const now = new Date()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

    if (cache && cache.lastUsed && now - new Date(cache.lastUsed) <= THIRTY_DAYS) {
      // lastUsed is recent, return cached value (lastUsed is updated in getCohortCache)
      return res.json({
        success: true,
        data: {
          wastedSlices: { mean: Number(cache.wastedSlicesAverage), points: null },
          wastedCoverage: {
            mean: cache.wastedCoverageAverage != null ? Number(cache.wastedCoverageAverage) : null,
            points: null,
          },
        },
        fromCache: true,
      })
    }

    // No cache or stale — trigger background recalculation and return stale data immediately
    // to avoid Heroku 30s HTTP timeout (processCohortInChunks can take minutes)
    if (!_recalcInProgress.has(cohortId)) {
      _recalcInProgress.add(cohortId)
      setImmediate(async () => {
        try {
          await require('./precalc').processCohortInChunks(Number(cohortId), 10)
        } catch (error) {
          logger.warn('[statistics] Background wasted slices cache recalculation failed', error)
        } finally {
          _recalcInProgress.delete(cohortId)
        }
      })
    }
    return res.json({
      success: true,
      data: {
        wastedSlices: {
          mean: cache?.wastedSlicesAverage != null ? Number(cache.wastedSlicesAverage) : null,
          points: null,
        },
        wastedCoverage: {
          mean: cache?.wastedCoverageAverage != null ? Number(cache.wastedCoverageAverage) : null,
          points: null,
        },
      },
      fromCache: true,
      recalculating: true,
    })
  }

  const region = await resolveRegionFromWhom(req.query.whom)
  const isSingleUser = req.query.whom?.startsWith('user_') && req.query.whom.split(',').length === 1

  let data
  if (isSingleUser && region) {
    // Direct SQL path — rows already expanded with scalar fields, no CTE overhead
    const userId = req.query.whom.split('_')[1]
    const bodyParts = req.query.bodyPart
      ? typeof req.query.bodyPart === 'string'
        ? [req.query.bodyPart]
        : req.query.bodyPart
      : null
    const sql = StatisticService.getDirectWastedSlicesSql(userId, region, bodyParts)
    const rawData = await queryWithTimeout(sequelize, sql, { type: sequelize.QueryTypes.SELECT }, 30000)
    // Reconstruct answer array for calculateCoverage compatibility
    data = rawData.map((row) => ({
      ...row,
      answer: [{ spacing: row.answerSpacing || 0, thickness: row.answerThickness || 0 }],
    }))
  } else {
    // Existing CTE path for multi-user / cohort / everyone queries
    const sql = StatisticService.getStatisticFactorWastedSlicesSql(where, null, { region })
    data = await queryWithTimeout(sequelize, sql, { type: sequelize.QueryTypes.SELECT }, 30000)
    data = StatisticService.expandWastedSlicesRows(data)
  }

  if (req.query.whom && req.query.whom.startsWith('user_')) {
    const dataByUser = _.groupBy(data, (d) => `user_${d['questionSetResult.userId']}`)
    const processedData = _.mapValues(dataByUser, (userData) => processData(userData, showMean, showPoints))
    return res.json({ success: true, data: processedData })
  } else {
    const result = processData(data, showMean, showPoints)
    // If cohort, update cache in background
    if (cohortId && showMean && !showPoints) {
      setImmediate(async () => {
        try {
          const slicesMean = result.wastedSlices.mean
          const coverageMean = result.wastedCoverage.mean
          await cacheHelper.updateCohortCache(
            cohortId,
            null,
            isNaN(slicesMean) ? null : slicesMean,
            isNaN(coverageMean) ? null : coverageMean
          )
        } catch (error) {
          logger.warn('[statistics] Failed to update cohort wasted slices cache', error)
        }
      })
    }
    res.json({
      success: true,
      data: result,
    })
  }
})

// Only get the scores for a given whom
router.get('/statistics/tests/:whom/scores', fetchLoggedInUser, async function (req, res) {
  let where = {}
  await whomFilter(where, req.params.whom)

  if (where.id) {
    where = {
      userId: where.id,
    }
  }

  const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
  const region = await resolveRegionFromWhom(req.params.whom)
  const sql = StatisticService.getStatisticTestSql(where, pagination, { region })
  let data = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  })

  res.json({
    success: true,
    ...formatPaginatedResponse(
      data.map((d) => new Number(d.score)),
      pagination
    ),
  })
})

router.get('/statistics/tests/whom', fetchLoggedInUser, async function (req, res) {
  let where = {}
  await whomFilter(where, req.query.whom)

  const includeChallengeMode =
    String(req.query.include_challenge_mode_scores).toLowerCase() === 'true' &&
    (await isManagerOrAdmin(req.session.user))

  const Op = Sequelize.Op
  let userIds = []

  if (Array.isArray(where.id)) {
    userIds = where.id
  } else if (where.id && where.id[Op.in]) {
    userIds = where.id[Op.in]
  } else if (where.id && where.id[Op.notIn]) {
    const users = await User.findAll({
      attributes: ['id'],
      where: {
        id: {
          [Op.notIn]: where.id[Op.notIn],
        },
      },
    })
    userIds = users.map((u) => u.id)
  } else if (where.id) {
    userIds = [where.id]
  }

  // check if caller asked for exactly one user
  const requestedWhomIsUsers = req.query.whom && req.query.whom.startsWith('user_')
  const requestedSingleUser = requestedWhomIsUsers && req.query.whom.split(',').length === 1

  // Build final shaped object { user_<id>: [...] } — batch for all users at once
  const cachedMap = await statsCacheHelper.batchGetOrRecalcUserTests(userIds, !!includeChallengeMode)

  const rawData = {}

  for (const uid of userIds) {
    const rows = cachedMap[uid] || []

    // Same rule:
    // - if single user request: always include that key, even if []
    // - if multi/cohort: skip empty arrays so frontend doesn't choke
    if (rows.length > 0 || requestedSingleUser) {
      rawData[`user_${uid}`] = rows
    }
  }

  return res.json({ success: true, data: rawData })
})

// raw data (including time), should be useful as a base
// TODO: limit to admins if whom is everyone, otherwise limit to cohort
router.get('/statistics/mc/:whom', fetchLoggedInUser, async function (req, res) {
  let where = {}
  await whomFilter(where, req.params.whom)

  const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
  const region = await resolveRegionFromWhom(req.params.whom)
  const rawDataSql = StatisticService.getStatisticMcWhomSql(where, pagination, { region })

  let rawData = await sequelize.query(rawDataSql, {
    type: sequelize.QueryTypes.SELECT,
  })

  return res.json({ success: true, ...formatPaginatedResponse(rawData, pagination) })
})

// The average of all multiple choice scores per category
// TODO: limit to admins if whom is everyone, otherwise limit to cohort
router.get('/statistics/mc/:whom/average', async function (req, res) {
  let where = {}
  await whomFilter(where, req.params.whom)

  const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
  const region = await resolveRegionFromWhom(req.params.whom)
  const rawSql = StatisticService.getMCAverageSql(where, pagination, { region, perDifficulty: true })
  let rawData = await sequelize.query(rawSql, {
    type: sequelize.QueryTypes.SELECT,
  })

  res.json({ success: true, ...formatPaginatedResponse(rawData, pagination) })
})

// The average of all multiple choice scores overall
// TODO: limit to admins if whom is everyone, otherwise limit to cohort
router.get('/statistics/mc/:whom/average_overall', async function (req, res) {
  let where = {}
  await whomFilter(where, req.params.whom)

  const pagination = parsePaginationParams(req.query, { defaultLimit: 1000000, maxLimit: 1000000 })
  const region = await resolveRegionFromWhom(req.params.whom)
  const rawSql = StatisticService.getMCAverageSql(where, pagination, { region })
  let rawData = await sequelize.query(rawSql, {
    type: sequelize.QueryTypes.SELECT,
  })

  res.json({ success: true, ...formatPaginatedResponse(rawData, pagination) })
})

// Student data report endpoint for API key access
router.get('/statistics/student-report/:studentId', fetchLoggedInUser, async function (req, res) {
  const studentId = parseInt(req.params.studentId, 10)

  // Validate cohort access for API keys
  if (req.session && req.session.apiKey) {
    const apiKey = req.session.apiKey

    // Check if the student belongs to the API key's cohort
    const cohortStudent = await CohortStudent.findOne({
      where: {
        userId: studentId,
        cohortId: apiKey.cohortId,
      },
    })

    if (!cohortStudent) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: API key can only access students from its associated cohort',
        code: 'COHORT_ACCESS_DENIED',
      })
    }
  }

  try {
    const studentReportService = require('./services/studentReport.service')
    const responseData = await studentReportService.getStudentReportData(studentId)

    res.json({ success: true, data: responseData })
  } catch (error) {
    console.error('Error in student report:', error)

    if (error.message === 'Student not found') {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
      })
    }

    if (error.message === 'Student is not part of any cohort') {
      return res.status(404).json({
        success: false,
        error: 'Student is not part of any cohort',
        code: 'STUDENT_NOT_IN_COHORT',
      })
    }

    res.status(500).json({
      success: false,
      error: 'Error generating student report',
      code: 'REPORT_ERROR',
    })
  }
})

// Cohort students report endpoint for API key access
router.get('/statistics/cohort-students-report', fetchLoggedInUser, async function (req, res) {
  // API key access is required for this endpoint
  if (!req.session || !req.session.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key authentication required',
      code: 'API_KEY_REQUIRED',
    })
  }

  const cohortId = req.session.apiKey.cohortId

  // Set longer timeout for large cohorts
  req.setTimeout(600000) // 10 minutes
  res.setTimeout(600000)

  try {
    const studentReportService = require('./services/studentReport.service')

    // Send initial response headers to prevent timeout
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    })

    // Start processing and send periodic updates
    const startTime = Date.now()
    console.log(`Starting cohort students report generation for cohort ${cohortId}`)

    const responseData = await studentReportService.getCohortStudentsReportData(cohortId)

    const endTime = Date.now()
    const processingTime = Math.round((endTime - startTime) / 1000)
    console.log(`Completed cohort students report for cohort ${cohortId} in ${processingTime}s`)

    // Send final response
    res.end(
      JSON.stringify({
        success: true,
        data: responseData,
        processingTime: processingTime,
      })
    )
  } catch (error) {
    console.error('Error in cohort students report:', error)

    // Handle different error types
    let statusCode = 500
    let errorCode = 'COHORT_REPORT_ERROR'
    let errorMessage = 'Error generating cohort students report'

    if (error.message === 'Cohort not found') {
      statusCode = 404
      errorCode = 'COHORT_NOT_FOUND'
      errorMessage = 'Cohort not found'
    } else if (error.message === 'No students found in cohort') {
      statusCode = 404
      errorCode = 'NO_STUDENTS_IN_COHORT'
      errorMessage = 'No students found in cohort'
    }

    // Send error response
    if (!res.headersSent) {
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode,
      })
    } else {
      // Headers already sent — try to end the response cleanly.
      // If the socket is already dead (e.g. connection reset), res.end() itself
      // can throw, so wrap it to prevent an uncaught exception → process crash → H18.
      try {
        res.end(
          JSON.stringify({
            success: false,
            error: errorMessage,
            code: errorCode,
          })
        )
      } catch (endErr) {
        logger.error('[cohort-students-report] Failed to end response after error', endErr)
        res.destroy()
      }
    }
  }
})

module.exports = { router, findMCAverageParams }
