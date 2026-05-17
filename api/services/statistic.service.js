const { Op } = require('sequelize')
const { whereObjectToSql } = require('../../util/sql')
const ModelProvider = require('../providers/model.provider')
const { getMineCohortArea } = require('../api_util/api_util')
const { USER_AREA } = require('../../util/constants')
const {
  sequelize,
  StackQuestionResult,
  StackQuestionResultComment,
  User,
  UserInformationEuWest,
  UserInformation,
} = require('../../db/models')
const _ = require('lodash')

/**
 * Build a SQL LIMIT / OFFSET suffix from a pagination object.
 * Returns an empty string when pagination is not provided so existing
 * callers are completely unaffected.
 *
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @returns {string}
 */
function buildPaginationClause(pagination) {
  if (!pagination) return ''
  const parts = []
  if (pagination.limit != null) parts.push(`LIMIT ${Math.max(1, parseInt(pagination.limit, 10))}`)
  if (pagination.offset != null) parts.push(`OFFSET ${Math.max(0, parseInt(pagination.offset, 10))}`)
  return parts.length ? '\n  ' + parts.join(' ') : ''
}

const getQueryAllStackQuestionResultEUWestSql = (where, limit = 5000) => {
  return `
    SELECT
        sqr.id,
        sqr.score,
        sqr."answer"::jsonb,
        sqr."attemptedAnswerIdentifier",
        sqr."groupScoreVariables"::jsonb,
        sqr."sliceViews"::jsonb,
        sqr."answerViews"::jsonb,
        sqr.skipped,
        sqr.freebie,
        sqr."sliceQuantScores"::jsonb,
        sqr."skillScores"::jsonb,
        sqr."stackQuestionId",
        sqr."questionSetResultId",
        COALESCE(
        json_agg(
            json_build_object(
            'id', sqrc.id,
            'comment', sqrc.comment,
            'seenAt', sqrc."seenAt",
            'lastedUpdatedAt', sqrc."lastedUpdatedAt",
            'seen', sqrc.seen,
            'viewedUserId', sqrc."viewedUserId",
            'commentedUserId', sqrc."commentedUserId",
            'stackQuestionResultId', sqrc."stackQuestionResultId",
            'createdAt', sqrc."createdAt",
            'commentedUser', json_build_object(
                'id', cu.id
            ),
            'viewedUser', json_build_object(
                'id', vu.id
            )
            )
            ORDER BY sqrc."createdAt" ASC
        ) FILTER (WHERE sqrc.id IS NOT NULL),
        '[]'
        ) AS "stackQuestionResultComments"
    FROM "eu_west_server_public"."StackQuestionResults" sqr
        LEFT JOIN "eu_west_server_public"."StackQuestionResultComments" sqrc
        ON sqr.id = sqrc."stackQuestionResultId"
    LEFT JOIN "Users" cu
        ON sqrc."commentedUserId" = cu.id
    LEFT JOIN "Users" vu
        ON sqrc."viewedUserId" = vu.id
    WHERE ${whereObjectToSql(where, true, 'sqr')}
    GROUP BY 
        sqr.id, 
        sqr."score", 
        sqr."attemptedAnswerIdentifier", 
        sqr."createdAt", 
        sqr."updatedAt",
        sqr."answer"::jsonb,
        sqr."attemptedAnswerIdentifier",
        sqr."groupScoreVariables"::jsonb,
        sqr."sliceViews"::jsonb,
        sqr."answerViews"::jsonb,
        sqr.skipped,
        sqr.freebie,
        sqr."sliceQuantScores"::jsonb,
        sqr."skillScores"::jsonb,
        sqr."stackQuestionId",
        sqr."questionSetResultId"
    LIMIT ${parseInt(limit, 10)}
    `
}

/**
 * Mirror of getQueryAllStackQuestionResultEUWestSql for the default (US_EAST) schema.
 *
 * Uses the same JSON_AGG approach — a single pass over StackQuestionResults with
 * LEFT JOINs only to StackQuestionResultComments and the two User rows per comment.
 * This avoids the four extra JOINs (User → UserInformation × 2 per association)
 * that the Sequelize findAll include tree was generating, and removes all ORM
 * object-building overhead for what can be a 10 000-row result set.
 */
const getQueryAllStackQuestionResultUSEastSql = (where, limit = 5000) => {
  return `
    SELECT
        sqr.id,
        sqr.score,
        sqr."answer"::jsonb,
        sqr."attemptedAnswerIdentifier",
        sqr."groupScoreVariables"::jsonb,
        sqr."sliceViews"::jsonb,
        sqr."answerViews"::jsonb,
        sqr.skipped,
        sqr.freebie,
        sqr."sliceQuantScores"::jsonb,
        sqr."skillScores"::jsonb,
        sqr."stackQuestionId",
        sqr."questionSetResultId",
        COALESCE(
        json_agg(
            json_build_object(
            'id', sqrc.id,
            'comment', sqrc.comment,
            'seenAt', sqrc."seenAt",
            'lastedUpdatedAt', sqrc."lastedUpdatedAt",
            'seen', sqrc.seen,
            'viewedUserId', sqrc."viewedUserId",
            'commentedUserId', sqrc."commentedUserId",
            'stackQuestionResultId', sqrc."stackQuestionResultId",
            'createdAt', sqrc."createdAt",
            'commentedUser', json_build_object(
                'id', cu.id
            ),
            'viewedUser', json_build_object(
                'id', vu.id
            )
            )
            ORDER BY sqrc."createdAt" ASC
        ) FILTER (WHERE sqrc.id IS NOT NULL),
        '[]'
        ) AS "stackQuestionResultComments"
    FROM "StackQuestionResults" sqr
        LEFT JOIN "StackQuestionResultComments" sqrc
        ON sqr.id = sqrc."stackQuestionResultId"
    LEFT JOIN "Users" cu
        ON sqrc."commentedUserId" = cu.id
    LEFT JOIN "Users" vu
        ON sqrc."viewedUserId" = vu.id
    WHERE ${whereObjectToSql(where, true, 'sqr')}
    GROUP BY
        sqr.id,
        sqr.score,
        sqr."attemptedAnswerIdentifier",
        sqr."createdAt",
        sqr."updatedAt",
        sqr."answer"::jsonb,
        sqr."groupScoreVariables"::jsonb,
        sqr."sliceViews"::jsonb,
        sqr."answerViews"::jsonb,
        sqr.skipped,
        sqr.freebie,
        sqr."sliceQuantScores"::jsonb,
        sqr."skillScores"::jsonb,
        sqr."stackQuestionId",
        sqr."questionSetResultId"
    LIMIT ${parseInt(limit, 10)}
    `
}

// base (full) US_EAST test run query
const getQueryTestRunInUsEastsSql = (whereTestRun, whereQuestionSetResults) => {
  const whereUserId = {}
  if (whereTestRun.userId) {
    whereUserId.userId = whereTestRun.userId
  }

  return `
    WITH mcqr_agg AS (
      SELECT 
        mcqr."testRunId",
        json_agg(
          json_build_object(
            'score', mcqr.score,
            'multipleChoiceQuestion', json_build_object('id', mcq.id)
          )
        ) AS "multipleChoiceQuestionResults"
      FROM "MultipleChoiceQuestionResults" mcqr
      INNER JOIN "MultipleChoiceQuestions" mcq
        ON mcqr."multipleChoiceQuestionId" = mcq.id
      WHERE ${whereObjectToSql(whereUserId, true, 'mcqr')}
      GROUP BY mcqr."testRunId"
    ),
    comment_flags AS (
      SELECT
        qsr."id" AS "questionSetResultId",
        BOOL_OR(sqrc."commentedUserId" != qsr."userId")                            AS "hasAdminComment",
        BOOL_OR((sqrc."commentedUserId" != qsr."userId") AND (sqrc."seen" = FALSE)) AS "hasUnseenAdminComment",
        BOOL_OR(sqrc."commentedUserId" = qsr."userId")                              AS "hasUserReply",
        BOOL_OR((sqrc."commentedUserId" = qsr."userId") AND (sqrc."seen" = FALSE))  AS "hasUnseenUserReply"
      FROM "QuestionSetResults" qsr
      INNER JOIN "TestRuns" tr2
        ON qsr."testRunId" = tr2."id"
      LEFT JOIN "StackQuestionResults" sqr
        ON sqr."questionSetResultId" = qsr."id"
      LEFT JOIN "StackQuestionResultComments" sqrc
        ON sqrc."stackQuestionResultId" = sqr."id"
      WHERE ${whereObjectToSql(whereTestRun, true, 'tr2')}
        AND ${whereObjectToSql(whereQuestionSetResults, true, 'qsr')}
      GROUP BY qsr."id"
    )
    SELECT
      tr."id",
      tr."score",
      tr."isSandbox",
      tr."preparedExamId",
      tr."timeEnded" AS "timestamp",
      u."id" AS "userId",
      ui."legalName" AS "legalName",
      qsr."id" AS "questionSetResultId",
      qsr."score" AS "questionSetResultScore",
      qsr."testRunId" AS "testRunId",
      bp."name" AS "bodyPart",
      bp."id" AS "bodyPartId",
      bp."contrastTypes"::jsonb AS "contrastTypes",
      r."name" AS "region",
      r."id" AS "regionId",
      COALESCE(mcqr_agg."multipleChoiceQuestionResults", '[]') AS "multipleChoiceQuestionResults",
      COALESCE(cf."hasAdminComment", FALSE)         AS "hasAdminComment",
      COALESCE(cf."hasUnseenAdminComment", FALSE)   AS "hasUnseenAdminComment",
      COALESCE(cf."hasUserReply", FALSE)            AS "hasUserReply",
      COALESCE(cf."hasUnseenUserReply", FALSE)      AS "hasUnseenUserReply"
    FROM "TestRuns" tr
    INNER JOIN "Users" u ON tr."userId" = u.id
    INNER JOIN "QuestionSetResults" qsr ON qsr."testRunId" = tr.id
    INNER JOIN "QuestionSets" qs ON qsr."questionSetId" = qs.id
    INNER JOIN "BodyParts" bp ON qs."bodyPartId" = bp.id
    INNER JOIN "Regions" r ON bp."regionId" = r.id
    LEFT JOIN "UserInformations" ui ON ui."userId" = u.id
    LEFT JOIN mcqr_agg ON mcqr_agg."testRunId" = tr.id
    LEFT JOIN comment_flags cf ON cf."questionSetResultId" = qsr."id"
    WHERE ${whereObjectToSql(whereTestRun, true, 'tr')}
      AND ${whereObjectToSql(whereQuestionSetResults, true, 'qsr')}
    ORDER BY tr."timeEnded"
  `
}

// base (full) EU_WEST test run query
const getQueryTestRunInEUWestsSql = (whereTestRun, whereQuestionSetResults) => {
  const whereUserId = {}
  if (whereTestRun.userId) {
    whereUserId.userId = whereTestRun.userId
  }

  return `
    WITH mcqr_agg AS (
      SELECT 
        mcqr."testRunId",
        json_agg(
          json_build_object(
            'score', mcqr.score,
            'multipleChoiceQuestion', json_build_object('id', mcq.id)
          )
        ) AS "multipleChoiceQuestionResults"
      FROM "eu_west_server_public"."MultipleChoiceQuestionResults" mcqr
      INNER JOIN "MultipleChoiceQuestions" mcq
        ON mcqr."multipleChoiceQuestionId" = mcq.id
      WHERE ${whereObjectToSql(whereUserId, true, 'mcqr')}
      GROUP BY mcqr."testRunId"
    ),
    comment_flags AS (
      SELECT
        qsr."id" AS "questionSetResultId",
        BOOL_OR(sqrc."commentedUserId" != qsr."userId")                            AS "hasAdminComment",
        BOOL_OR((sqrc."commentedUserId" != qsr."userId") AND (sqrc."seen" = FALSE)) AS "hasUnseenAdminComment",
        BOOL_OR(sqrc."commentedUserId" = qsr."userId")                              AS "hasUserReply",
        BOOL_OR((sqrc."commentedUserId" = qsr."userId") AND (sqrc."seen" = FALSE))  AS "hasUnseenUserReply"
      FROM "eu_west_server_public"."QuestionSetResults" qsr
      INNER JOIN "TestRuns" tr2
        ON qsr."testRunId" = tr2."id"
      LEFT JOIN "eu_west_server_public"."StackQuestionResults" sqr
        ON sqr."questionSetResultId" = qsr."id"
      LEFT JOIN "eu_west_server_public"."StackQuestionResultComments" sqrc
        ON sqrc."stackQuestionResultId" = sqr."id"
      WHERE ${whereObjectToSql(whereTestRun, true, 'tr2')}
        AND ${whereObjectToSql(whereQuestionSetResults, true, 'qsr')}
      GROUP BY qsr."id"
    )
    SELECT
      tr."id",
      tr."score",
      tr."isSandbox",
      tr."preparedExamId",
      tr."timeEnded" AS "timestamp",
      u."id" AS "userId",
      ui."legalName" AS "legalName",
      qsr."id" AS "questionSetResultId",
      qsr."score" AS "questionSetResultScore",
      qsr."testRunId" AS "testRunId",
      bp."name" AS "bodyPart",
      bp."id" AS "bodyPartId",
      bp."contrastTypes"::jsonb AS "contrastTypes",
      r."name" AS "region",
      r."id" AS "regionId",
      COALESCE(mcqr_agg."multipleChoiceQuestionResults", '[]') AS "multipleChoiceQuestionResults",
      COALESCE(cf."hasAdminComment", FALSE)         AS "hasAdminComment",
      COALESCE(cf."hasUnseenAdminComment", FALSE)   AS "hasUnseenAdminComment",
      COALESCE(cf."hasUserReply", FALSE)            AS "hasUserReply",
      COALESCE(cf."hasUnseenUserReply", FALSE)      AS "hasUnseenUserReply"
    FROM "TestRuns" tr
    INNER JOIN "Users" u ON tr."userId" = u.id
    INNER JOIN "eu_west_server_public"."QuestionSetResults" qsr ON qsr."testRunId" = tr.id
    INNER JOIN "QuestionSets" qs ON qsr."questionSetId" = qs.id
    INNER JOIN "BodyParts" bp ON qs."bodyPartId" = bp.id
    INNER JOIN "Regions" r ON bp."regionId" = r.id
    LEFT JOIN "eu_west_server_public"."UserInformations" ui ON ui."userId" = u.id
    LEFT JOIN mcqr_agg ON mcqr_agg."testRunId" = tr.id
    LEFT JOIN comment_flags cf ON cf."questionSetResultId" = qsr."id"
    WHERE ${whereObjectToSql(whereTestRun, true, 'tr')}
      AND ${whereObjectToSql(whereQuestionSetResults, true, 'qsr')}
    ORDER BY tr."timeEnded"
  `
}

/**
 * Full base statistics query with optional pagination and region filtering.
 * @param {object} where
 * @param {object} challengeModeFilter
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticSql = (where, challengeModeFilter, pagination, options = {}) => {
  return `
  ${ModelProvider.generateCombinedQuery(
    [
      { tableName: 'QuestionSetResults', where: { userId: where.id, ...challengeModeFilter } },
      { tableName: 'TestRuns', where: { userId: where.id } },
    ],
    { region: options.region }
  )}
  SELECT
    DISTINCT qsr."id" AS "questionSetResultId",
    c."area" as "cohortArea",
    u."id" AS "userId",
    COALESCE (ui."legalName", uei."legalName", 'N/A') AS "legalName",
    qsr."score" AS "questionSetResultScore",
    qsr."createdAt" AS "timestamp",
    bp."name" AS "bodyPart",
    bp."id" AS "bodyPartId",
    r."name" AS "region",
    r."id" AS "regionId",
    tr."isSandbox" AS "isSandbox",
    tr."score" AS "score",
    tr."patientPrepScore" AS "patientPrepScore",
    tr."patientPrepScores"::jsonb AS "patientPrepScores",
    tr."questionSetScore" AS "questionSetScore",
    qsr."sliceQuantScore" AS "sliceQuantScore",
    qsr."overallSkillScores"::jsonb AS "overallSkillScores",
    tr."preparedExamId" AS "preparedExamId"
  FROM "Users" u
  LEFT JOIN "public"."UserInformations" ui 
    ON ui."userId" = "u"."id"
  LEFT JOIN "eu_west_server_public"."UserInformations" uei 
    ON uei."userId" = "u"."id"
  INNER JOIN "CohortStudents" cs
    ON u."id" = cs."userId"
  INNER JOIN "Cohorts" c
    ON c."id" = cs."cohortId"
  INNER JOIN "CombinedQuestionSetResults" qsr
    ON u."id" = qsr."userId"
  INNER JOIN "QuestionSets" qs
    ON qsr."questionSetId" = qs."id"
  INNER JOIN "BodyParts" bp
    ON qs."bodyPartId" = bp."id"
  INNER JOIN "Regions" r
    ON bp."regionId" = r."id"
  INNER JOIN "CombinedTestRuns" tr
    ON qsr."combinedTestRunId" = tr."combinedId"
  WHERE ${whereObjectToSql(where, true, 'u')} AND ${whereObjectToSql(challengeModeFilter, true, 'qsr')}
  GROUP BY
    u."id",
    COALESCE (ui."legalName", uei."legalName", 'N/A'),
    c."id",
    bp."id",
    r."id",
    tr."id",
    qsr."id",
    tr."patientPrepScores"::jsonb,
    qsr."overallSkillScores"::jsonb,
    qsr."score",
    qsr."createdAt",
    qsr."sliceQuantScore",
    tr."isSandbox",
    tr."score",
    tr."patientPrepScore",
    tr."questionSetScore",
    tr."preparedExamId"
  ORDER BY qsr."createdAt"${buildPaginationClause(pagination)}
  `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticFactorAngleSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where: { userId: where['$questionSetResult.userId$'] } },
        { tableName: 'TestRuns', where: { userId: where['$questionSetResult.userId$'] } },
        { tableName: 'StackQuestionResults', subWhere: { userId: where['$questionSetResult.userId$'] } },
      ],
      { region: options.region }
    )}
    SELECT
      "questionSetResult"."createdAt" AS "createdAt",
      "questionSetResult"."id" AS "questionSetResultId",
      "questionSetResult->questionSet->bodyPart"."name" AS "bodyPart",
      "questionSetResult->questionSet->bodyPart"."id" AS "bodyPartId",
      "StackQuestionResult"."groupScoreVariables"::jsonb AS "groupScoreVariables",
      "StackQuestionResult"."sliceQuantScores"::jsonb AS "rawSliceQuantScores",
      "questionSetResult"."userId" AS "questionSetResult.userId",
      "stackQuestion"."order" AS "questionOrder",
      "questionSetResult->testRun"."preparedExamId" AS "preparedExamId"
    FROM "CombinedStackQuestionResults" AS "StackQuestionResult"
    INNER JOIN "CombinedQuestionSetResults" AS "questionSetResult"
      ON "StackQuestionResult"."combinedQuestionSetResultIdId" = "questionSetResult"."combinedId"
    INNER JOIN "QuestionSets" AS "questionSetResult->questionSet"
      ON "questionSetResult"."questionSetId" = "questionSetResult->questionSet"."id"
    INNER JOIN "BodyParts" AS "questionSetResult->questionSet->bodyPart"
      ON "questionSetResult->questionSet"."bodyPartId" = "questionSetResult->questionSet->bodyPart"."id"
    INNER JOIN "CombinedTestRuns" AS "questionSetResult->testRun"
      ON "questionSetResult"."combinedTestRunId" = "questionSetResult->testRun"."combinedId"
    LEFT JOIN "StackQuestions" AS "stackQuestion"
      ON "StackQuestionResult"."stackQuestionId" = "stackQuestion"."id"
    WHERE
      ${whereObjectToSql(where, true)}
      AND "StackQuestionResult"."score" IS NOT NULL
      AND "StackQuestionResult"."groupScoreVariables" IS NOT NULL
      AND "questionSetResult->testRun"."isSandbox" = false
    ORDER BY "StackQuestionResult"."createdAt", "stackQuestion"."order"${buildPaginationClause(pagination)}
  `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticFactorWastedSlicesSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where: { userId: where['$questionSetResult.userId$'] } },
        { tableName: 'TestRuns', where: { userId: where['$questionSetResult.userId$'] } },
        { tableName: 'StackQuestionResults', subWhere: { userId: where['$questionSetResult.userId$'] } },
      ],
      { region: options.region }
    )}
    SELECT
      "questionSetResult"."createdAt" AS "createdAt",
      "questionSetResult"."id" AS "questionSetResultId",
      "questionSetResult->questionSet->bodyPart"."name" AS "bodyPart",
      "questionSetResult->questionSet->bodyPart"."id" AS "bodyPartId",
      "StackQuestionResult"."groupScoreVariables"::jsonb AS "groupScoreVariables",
      "StackQuestionResult"."sliceQuantScores"::jsonb AS "rawSliceQuantScores",
        "StackQuestionResult"."answer",
        "questionSetResult"."userId" AS "questionSetResult.userId",
        "stackQuestion"."order" AS "questionOrder",
        "questionSetResult->testRun"."preparedExamId" AS "preparedExamId"
    FROM "CombinedStackQuestionResults" AS "StackQuestionResult"
    INNER JOIN "CombinedQuestionSetResults" AS "questionSetResult"
      ON "StackQuestionResult"."combinedQuestionSetResultIdId" = "questionSetResult"."combinedId"
    INNER JOIN "QuestionSets" AS "questionSetResult->questionSet"
      ON "questionSetResult"."questionSetId" = "questionSetResult->questionSet"."id"
    INNER JOIN "BodyParts" AS "questionSetResult->questionSet->bodyPart"
      ON "questionSetResult->questionSet"."bodyPartId" = "questionSetResult->questionSet->bodyPart"."id"
    INNER JOIN "CombinedTestRuns" AS "questionSetResult->testRun"
      ON "questionSetResult"."combinedTestRunId" = "questionSetResult->testRun"."combinedId"
    LEFT JOIN "StackQuestions" AS "stackQuestion"
      ON "StackQuestionResult"."stackQuestionId" = "stackQuestion"."id"
    WHERE ${whereObjectToSql(where, true)}
      AND "StackQuestionResult"."score" IS NOT NULL
      AND "StackQuestionResult"."groupScoreVariables" IS NOT NULL
      AND "questionSetResult->testRun"."isSandbox" = false
    ORDER BY "StackQuestionResult"."createdAt", "stackQuestion"."order"${buildPaginationClause(pagination)}
    `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticTestSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        {
          tableName: 'TestRuns',
          where: { ...where, score: { [Op.not]: null, [Op.ne]: 'NaN' }, isSandbox: { [Op.eq]: false } },
        },
      ],
      { region: options.region }
    )}
    SELECT
      "score"
    FROM "CombinedTestRuns"
    WHERE
      ${whereObjectToSql(where, true)}
      AND "score" IS NOT NULL
      AND "score" != 'NaN'
      AND "isSandbox" = FALSE
    ORDER BY "timeEnded"${buildPaginationClause(pagination)}
  `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticFactorAngleOfMultiUserSql = (where, pagination, options = {}) => {
  return `
      ${ModelProvider.generateCombinedQuery(
        [
          { tableName: 'QuestionSetResults', where },
          { tableName: 'TestRuns', where },
          { tableName: 'StackQuestionResults', subWhere: where },
        ],
        { region: options.region }
      )}
      SELECT 
        "questionSetResult"."createdAt" AS "createdAt", 
        "questionSetResult"."id" AS "questionSetResultId", 
        "questionSetResult->questionSet->bodyPart"."name" AS "bodyPart", 
        "questionSetResult->questionSet->bodyPart"."id" AS "bodyPartId",
        "StackQuestionResult"."groupScoreVariables"::jsonb AS "groupScoreVariables",
        "StackQuestionResult"."sliceQuantScores"::jsonb AS "rawSliceQuantScores",
        "questionSetResult"."userId" AS "questionSetResult.userId" 
      FROM "CombinedStackQuestionResults" AS "StackQuestionResult" 
      INNER JOIN "CombinedQuestionSetResults" AS "questionSetResult" 
        ON "StackQuestionResult"."combinedQuestionSetResultIdId" = "questionSetResult"."combinedId" 
      INNER JOIN "QuestionSets" AS "questionSetResult->questionSet" 
        ON "questionSetResult"."questionSetId" = "questionSetResult->questionSet"."id" 
      INNER JOIN "BodyParts" AS "questionSetResult->questionSet->bodyPart" 
        ON "questionSetResult->questionSet"."bodyPartId" = "questionSetResult->questionSet->bodyPart"."id" 
      INNER JOIN "CombinedTestRuns" AS "questionSetResult->testRun" 
        ON "questionSetResult"."combinedTestRunId" = "questionSetResult->testRun"."combinedId" 
      WHERE 
        ${whereObjectToSql(where, true, 'questionSetResult')}
        AND "StackQuestionResult"."score" IS NOT NULL
        AND "StackQuestionResult"."groupScoreVariables" IS NOT NULL
        AND "questionSetResult->testRun"."isSandbox" = FALSE
      ORDER BY "StackQuestionResult"."createdAt"${buildPaginationClause(pagination)}
  `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticWastedSlicesOfMultiUserSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where },
        { tableName: 'TestRuns', where },
        { tableName: 'StackQuestionResults', subWhere: where },
      ],
      { region: options.region }
    )}
    SELECT 
      "questionSetResult"."createdAt" AS "createdAt", 
      "questionSetResult"."id" AS "questionSetResultId", 
      "questionSetResult->questionSet->bodyPart"."name" AS "bodyPart", 
      "questionSetResult->questionSet->bodyPart"."id" AS "bodyPartId",
      "StackQuestionResult"."groupScoreVariables"::jsonb AS "groupScoreVariables",
      "StackQuestionResult"."sliceQuantScores"::jsonb AS "rawSliceQuantScores",
      "StackQuestionResult"."answer", 
      "questionSetResult"."userId" AS "questionSetResult.userId" 
    FROM "CombinedStackQuestionResults" AS "StackQuestionResult" 
    INNER JOIN "CombinedQuestionSetResults" AS "questionSetResult" 
      ON "StackQuestionResult"."combinedQuestionSetResultIdId" = "questionSetResult"."combinedId" 
    INNER JOIN "QuestionSets" AS "questionSetResult->questionSet" 
      ON "questionSetResult"."questionSetId" = "questionSetResult->questionSet"."id" 
    INNER JOIN "BodyParts" AS "questionSetResult->questionSet->bodyPart" 
      ON "questionSetResult->questionSet"."bodyPartId" = "questionSetResult->questionSet->bodyPart"."id" 
    INNER JOIN "CombinedTestRuns" AS "questionSetResult->testRun" 
      ON "questionSetResult"."combinedTestRunId" = "questionSetResult->testRun"."combinedId" 
    WHERE ${whereObjectToSql(where, true, 'questionSetResult')}
      AND "StackQuestionResult"."score" IS NOT NULL 
      AND "StackQuestionResult"."groupScoreVariables" IS NOT NULL 
      AND "questionSetResult->testRun"."isSandbox" = false 
    ORDER BY "StackQuestionResult"."createdAt"${buildPaginationClause(pagination)}
    `
}

/**
 * Combined query for precalc: fetches ALL columns needed for both angle AND wasted-slices
 * in a single DB round-trip instead of two separate queries per chunk.
 */
/**
 * Combined query for precalc: fetches ALL columns for both angle AND wasted-slices.
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getCombinedAngleAndWastedSlicesOfMultiUserSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where },
        { tableName: 'TestRuns', where },
        { tableName: 'StackQuestionResults', subWhere: where },
      ],
      { region: options.region }
    )}
    SELECT
      "questionSetResult"."createdAt" AS "createdAt",
      "questionSetResult"."id" AS "questionSetResultId",
      "questionSetResult->questionSet->bodyPart"."name" AS "bodyPart",
      "questionSetResult->questionSet->bodyPart"."id" AS "bodyPartId",
      "StackQuestionResult"."groupScoreVariables"::jsonb AS "groupScoreVariables",
      "StackQuestionResult"."sliceQuantScores"::jsonb AS "rawSliceQuantScores",
      "StackQuestionResult"."answer",
      "questionSetResult"."userId" AS "questionSetResult.userId"
    FROM "CombinedStackQuestionResults" AS "StackQuestionResult"
    INNER JOIN "CombinedQuestionSetResults" AS "questionSetResult"
      ON "StackQuestionResult"."combinedQuestionSetResultIdId" = "questionSetResult"."combinedId"
    INNER JOIN "QuestionSets" AS "questionSetResult->questionSet"
      ON "questionSetResult"."questionSetId" = "questionSetResult->questionSet"."id"
    INNER JOIN "BodyParts" AS "questionSetResult->questionSet->bodyPart"
      ON "questionSetResult->questionSet"."bodyPartId" = "questionSetResult->questionSet->bodyPart"."id"
    INNER JOIN "CombinedTestRuns" AS "questionSetResult->testRun"
      ON "questionSetResult"."combinedTestRunId" = "questionSetResult->testRun"."combinedId"
    WHERE ${whereObjectToSql(where, true, 'questionSetResult')}
      AND "StackQuestionResult"."score" IS NOT NULL
      AND "StackQuestionResult"."groupScoreVariables" IS NOT NULL
      AND "questionSetResult->testRun"."isSandbox" = false
    ORDER BY "StackQuestionResult"."createdAt"${buildPaginationClause(pagination)}
  `
}

const PRACTICE_EXAM_IDS = { MR: 48, CT: 7 }
const getPracticeExamId = () => (process.env.APP_MODALITY === 'CT' ? PRACTICE_EXAM_IDS.CT : PRACTICE_EXAM_IDS.MR)

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string, perDifficulty?: boolean }} [options]
 */
const getMCAverageSql = (where, pagination, options = {}) => {
  const { perDifficulty = false } = options
  const difficultySelect = perDifficulty ? `,\n      mcq."difficulty" AS "difficulty"` : ''
  const difficultyGroupBy = perDifficulty ? `,\n      mcq."difficulty"` : ''
  const practiceExamId = getPracticeExamId()
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'MultipleChoiceQuestionResults', where: { userId: where.id } },
        { tableName: 'TestRuns', where: { userId: where.id } },
      ],
      { region: options.region }
    )}
    SELECT
      u."id" AS "userId",
      COALESCE (ui."legalName", uei."legalName", 'N/A') AS "name",
      ROUND(AVG(mcqr."score"), 2) AS "score",
      cat."name" AS "category"${difficultySelect}
    FROM "Users" u
    LEFT JOIN "public"."UserInformations" ui
      ON ui."userId" = "u"."id"
    LEFT JOIN "eu_west_server_public"."UserInformations" uei
      ON uei."userId" = "u"."id"
    INNER JOIN "CombinedMultipleChoiceQuestionResults" mcqr
      ON u."id" = mcqr."userId"
    INNER JOIN "CombinedTestRuns" tr
      ON mcqr."combinedTestRunId" = tr."combinedId"
    INNER JOIN "MultipleChoiceQuestions" mcq
      ON mcqr."multipleChoiceQuestionId" = mcq."id"
    INNER JOIN "Categories" cat
      ON mcq."categoryId" = cat."id"
    WHERE
      ${whereObjectToSql(where, true, 'u')}
      AND (tr."preparedExamId" IS DISTINCT FROM ${practiceExamId})
      -- Exclude abandoned MC questions (no answer selected) from the average.
      -- TODO(follow-up): abandoned results store the literal string 'null'
      -- (JSON.stringify(null)); see criticalThinkingQuestion.service.js ~line 304.
      -- Drop the NULLIF once the persistence bug is fixed and existing rows are migrated.
      AND NULLIF(mcqr."answer", 'null') IS NOT NULL
    GROUP BY
      u."id",
      COALESCE (ui."legalName", uei."legalName", 'N/A'),
      cat."name"${difficultyGroupBy}${buildPaginationClause(pagination)}
    `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getExportDataSql = (where, pagination, options = {}) => {
  const { region } = options

  // When the region is known we can skip the CTE + UNION ALL mechanism entirely
  // and query the schema tables directly.
  //
  // The foreign tables (QuestionSetResults + TestRuns) are wrapped in a
  // subquery so PostgreSQL pushes their join to the foreign server as a
  // SINGLE remote query.  Without the subquery, the planner may use a
  // nested loop — fetching QSRs first, then issuing a separate FDW
  // round-trip per row to fetch the matching TestRun.  With ~100 ms
  // cross-region latency × hundreds of rows this alone can exceed 25 s.
  if (region === 'us_east' || region === 'eu_west') {
    const schema = region === 'us_east' ? 'public' : 'eu_west_server_public'
    const uiAlias = region === 'us_east' ? 'ui' : 'uei'
    const legalNameExpr = `COALESCE(${uiAlias}."legalName", 'N/A')`
    const userCondition = whereObjectToSql(where, true, 'u')

    return `
      SELECT DISTINCT
        fd."questionSetResultId",
        c."area" as "cohortArea",
        u."id" AS "userId",
        ${legalNameExpr} AS "legalName",
        fd."questionSetResultScore",
        fd."timestamp",
        bp."name" AS "bodyPart",
        bp."id" AS "bodyPartId",
        r."name" AS "region",
        r."id" AS "regionId",
        fd."isSandbox",
        fd."score",
        fd."sliceQuantScore",
        fd."preparedExamId",
        fd."testRunId",
        fd."duration"
      FROM "Users" u
      LEFT JOIN "${schema}"."UserInformations" ${uiAlias}
        ON ${uiAlias}."userId" = u."id"
      INNER JOIN "CohortStudents" cs
        ON u."id" = cs."userId"
      INNER JOIN "Cohorts" c
        ON c."id" = cs."cohortId"
      INNER JOIN (
        SELECT
          qsr."id"              AS "questionSetResultId",
          qsr."score"           AS "questionSetResultScore",
          qsr."createdAt"       AS "timestamp",
          qsr."sliceQuantScore" AS "sliceQuantScore",
          qsr."questionSetId",
          qsr."userId",
          tr."id"               AS "testRunId",
          tr."isSandbox",
          tr."score",
          tr."preparedExamId",
          tr."secondsActive"    AS "duration"
        FROM "${schema}"."QuestionSetResults" qsr
        INNER JOIN "${schema}"."TestRuns" tr
          ON qsr."testRunId" = tr."id"
        WHERE ${whereObjectToSql({ userId: where.id }, true, 'qsr')}
      ) fd ON u."id" = fd."userId"
      INNER JOIN "QuestionSets" qs
        ON fd."questionSetId" = qs."id"
      INNER JOIN "BodyParts" bp
        ON qs."bodyPartId" = bp."id"
      INNER JOIN "Regions" r
        ON bp."regionId" = r."id"
      WHERE ${userCondition}
      ORDER BY
        fd."timestamp"${buildPaginationClause(pagination)}
    `
  }

  // Fallback: region unknown (multi-user / 'everyone') — use CTE with UNION ALL
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where: { userId: where.id } },
        { tableName: 'TestRuns', where: { userId: where.id } },
      ],
      { region }
    )}
    SELECT DISTINCT
      qsr."id" AS "questionSetResultId",
      c."area" as "cohortArea",
      u."id" AS "userId",
      COALESCE(ui."legalName", uei."legalName", 'N/A') AS "legalName",
      qsr."score" AS "questionSetResultScore",
      qsr."createdAt" AS "timestamp",
      bp."name" AS "bodyPart",
      bp."id" AS "bodyPartId",
      r."name" AS "region",
      r."id" AS "regionId",
      tr."isSandbox" AS "isSandbox",
      tr."score" AS "score",
      qsr."sliceQuantScore" AS "sliceQuantScore",
      tr."preparedExamId" AS "preparedExamId",
      tr."id" AS "testRunId",
      tr."secondsActive" AS "duration"
    FROM "Users" u
    LEFT JOIN "public"."UserInformations" ui
      ON ui."userId" = u."id"
    LEFT JOIN "eu_west_server_public"."UserInformations" uei
      ON uei."userId" = u."id"
    INNER JOIN "CohortStudents" cs
      ON u."id" = cs."userId"
    INNER JOIN "Cohorts" c
      ON c."id" = cs."cohortId"
    INNER JOIN "CombinedQuestionSetResults" qsr
      ON u."id" = qsr."userId"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN "Regions" r
      ON bp."regionId" = r."id"
    INNER JOIN "CombinedTestRuns" tr
      ON qsr."combinedTestRunId" = tr."combinedId"
    WHERE ${whereObjectToSql(where, true, 'u')}
    ORDER BY
      qsr."createdAt"${buildPaginationClause(pagination)}
  `
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticBestSql = (where, pagination, options = {}) => {
  return `
    ${ModelProvider.generateCombinedQuery(
      [
        { tableName: 'QuestionSetResults', where: { userId: where.id } },
        { tableName: 'TestRuns', where: { userId: where.id } },
      ],
      { region: options.region }
    )}
    SELECT
      u."id" AS "userId",
      COALESCE (ui."legalName", uei."legalName", 'N/A') AS "legalName",
      MAX(
        COALESCE(qsr."sliceQuantScore", qsr."score")
      ) AS "score",
      bp."name" AS "bodyPart",
      bp."id" AS "bodyPartId"
    FROM "Users" u
    LEFT JOIN "public"."UserInformations" ui 
      ON ui."userId" = "u"."id"
    LEFT JOIN "eu_west_server_public"."UserInformations" uei 
      ON uei."userId" = "u"."id"
    INNER JOIN "CombinedQuestionSetResults" qsr
      ON u."id" = qsr."userId"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN "CombinedTestRuns" tr
      ON qsr."combinedTestRunId" = tr."combinedId"
    WHERE
      ${whereObjectToSql(where, true, 'u')}
      AND tr."isSandbox" = FALSE
      AND qsr."score" IS NOT NULL
      AND COALESCE(
        CAST(qsr."sliceQuantScore" AS TEXT),
        CAST(qsr."score" AS TEXT)
      ) <> 'NaN'
    GROUP BY
      u."id",
      bp."id",
      COALESCE (ui."legalName", uei."legalName", 'N/A'),
      bp."name"${buildPaginationClause(pagination)}
  `
}

// LIGHTWEIGHT flags helpers
const getCommentFlagsUSEast = async (questionSetResultIds = []) => {
  if (!questionSetResultIds.length) return {}
  const sql = `
    SELECT
      qsr."id" AS "questionSetResultId",
      BOOL_OR(sqrc."commentedUserId" != qsr."userId")                            AS "hasAdminComment",
      BOOL_OR((sqrc."commentedUserId" != qsr."userId") AND (sqrc."seen" = FALSE)) AS "hasUnseenAdminComment",
      BOOL_OR(sqrc."commentedUserId" = qsr."userId")                              AS "hasUserReply",
      BOOL_OR((sqrc."commentedUserId" = qsr."userId") AND (sqrc."seen" = FALSE))  AS "hasUnseenUserReply"
    FROM "QuestionSetResults" qsr
    LEFT JOIN "StackQuestionResults" sqr
      ON sqr."questionSetResultId" = qsr."id"
    LEFT JOIN "StackQuestionResultComments" sqrc
      ON sqrc."stackQuestionResultId" = sqr."id"
    WHERE qsr."id" IN (:qsrIds)
    GROUP BY qsr."id"
  `
  const rows = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { qsrIds: questionSetResultIds },
  })
  return _.keyBy(rows, 'questionSetResultId')
}

const getCommentFlagsEUWest = async (questionSetResultIds = []) => {
  if (!questionSetResultIds.length) return {}
  const sql = `
    SELECT
      qsr."id" AS "questionSetResultId",
      BOOL_OR(sqrc."commentedUserId" != qsr."userId")                            AS "hasAdminComment",
      BOOL_OR((sqrc."commentedUserId" != qsr."userId") AND (sqrc."seen" = FALSE)) AS "hasUnseenAdminComment",
      BOOL_OR(sqrc."commentedUserId" = qsr."userId")                              AS "hasUserReply",
      BOOL_OR((sqrc."commentedUserId" = qsr."userId") AND (sqrc."seen" = FALSE))  AS "hasUnseenUserReply"
    FROM "eu_west_server_public"."QuestionSetResults" qsr
    LEFT JOIN "eu_west_server_public"."StackQuestionResults" sqr
      ON sqr."questionSetResultId" = qsr."id"
    LEFT JOIN "eu_west_server_public"."StackQuestionResultComments" sqrc
      ON sqrc."stackQuestionResultId" = sqr."id"
    WHERE qsr."id" IN (:qsrIds)
    GROUP BY qsr."id"
  `
  const rows = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { qsrIds: questionSetResultIds },
  })
  return _.keyBy(rows, 'questionSetResultId')
}

// getTestRunAndGroupStackQuestionResultForOneUser (unchanged main logic)
const getTestRunAndGroupStackQuestionResultForOneUser = async (where, questionSetResultsWhere, whom) => {
  const userId = whom.split(',').map((id) => id.split('_')?.[1])[0]
  const cohortArea = await getMineCohortArea(userId)

  function decorateRow(el) {
    const bodyPartName = el.bodyPart
    if (el.contrastTypes && el.contrastTypes.withOut) {
      el.bodyPart = `${bodyPartName} Without`
    }

    el.isViewedAdminComment = !el.hasUnseenAdminComment
    el.isViewedUserReply = !el.hasUnseenUserReply
    el.isHasComment = !!el.hasAdminComment
    el.isHasReply = !!el.hasUserReply

    delete el.hasUnseenAdminComment
    delete el.hasUnseenUserReply
    delete el.hasAdminComment
    delete el.hasUserReply

    return el
  }

  if (cohortArea == USER_AREA.US_EAST) {
    const sqlEast = getQueryTestRunInUsEastsSql({ userId: where.id }, questionSetResultsWhere)
    const testRunInUsEasts = await sequelize.query(sqlEast, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId: where.id },
    })
    return testRunInUsEasts.map(decorateRow)
  } else {
    const sqlWest = getQueryTestRunInEUWestsSql({ userId: where.id }, questionSetResultsWhere)
    const testRunInEUWests = await sequelize.query(sqlWest, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId: where.id },
    })
    return testRunInEUWests.map(decorateRow)
  }
}

const getTestRunAndGroupStackQuestionResultForMultipleUsers = async (where, questionSetResultsWhere) => {
  const sqlEast = getQueryTestRunInUsEastsSql({ userId: where.id }, questionSetResultsWhere)
  const sqlWest = getQueryTestRunInEUWestsSql({ userId: where.id }, questionSetResultsWhere)

  const [testRunInUsEasts, testRunInEUWests] = await Promise.all([
    sequelize.query(sqlEast, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId: where.id },
    }),
    sequelize.query(sqlWest, {
      type: sequelize.QueryTypes.SELECT,
      replacements: { userId: where.id },
    }),
  ])

  function decorateRow(el) {
    const bodyPartName = el.bodyPart
    if (el.contrastTypes && el.contrastTypes.withOut) {
      el.bodyPart = `${bodyPartName} Without`
    }

    el.isViewedAdminComment = !el.hasUnseenAdminComment
    el.isViewedUserReply = !el.hasUnseenUserReply
    el.isHasComment = !!el.hasAdminComment
    el.isHasReply = !!el.hasUserReply

    delete el.hasUnseenAdminComment
    delete el.hasUnseenUserReply
    delete el.hasAdminComment
    delete el.hasUserReply

    return el
  }

  const merged = testRunInUsEasts.concat(testRunInEUWests).map(decorateRow)
  return merged
}

/**
 * @param {object} where
 * @param {{ limit?: number, offset?: number }} [pagination]
 * @param {{ region?: string }} [options]
 */
const getStatisticMcWhomSql = (where, pagination, options = {}) => {
  return `
  ${ModelProvider.generateCombinedQuery(
    [
      { tableName: 'MultipleChoiceQuestionResults', where: { userId: where.id } },
      { tableName: 'TestRuns', where: { userId: where.id } },
    ],
    {
      region: options.region,
    }
  )}
    SELECT
      u."id" AS "userId",
      COALESCE (ui."legalName", uei."legalName", 'N/A') AS "name",
      mcqr."score" AS "score",
      -- TODO(follow-up): NULLIF works around abandoned MC results storing the literal string
      -- 'null' (see criticalThinkingQuestion.service.js ~line 304). Drop the NULLIF once the
      -- persistence bug is fixed and existing 'null' rows are migrated to real NULL.
      NULLIF(mcqr."answer", 'null') AS "answer",
      cat."name" AS "category",
      mcq."difficulty" AS "difficulty",
      mcqr."createdAt" AS "timestamp",
      tr."preparedExamId" AS "preparedExamId"
    FROM "Users" u
    LEFT JOIN "public"."UserInformations" ui
      ON ui."userId" = "u"."id"
    LEFT JOIN "eu_west_server_public"."UserInformations" uei
      ON uei."userId" = "u"."id"
    INNER JOIN "CombinedMultipleChoiceQuestionResults" mcqr
      ON u."id" = mcqr."userId"
    INNER JOIN "MultipleChoiceQuestions" mcq
      ON mcqr."multipleChoiceQuestionId" = mcq."id"
    INNER JOIN "Categories" cat
      ON mcq."categoryId" = cat."id"
    LEFT JOIN "CombinedTestRuns" tr
      ON mcqr."testRunId" = tr."id"
    WHERE
      ${whereObjectToSql(where, true, 'u')}
    ORDER BY mcqr."createdAt"${buildPaginationClause(pagination)}
  `
}

/**
 * Extract the first element from sliceQuantScores, handling both array and non-array.
 * Replaces the SQL: CASE WHEN jsonb_typeof("sliceQuantScores") = 'array' ... ->0 pattern.
 */
function getFirstSliceQuantScore(raw) {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw[0] || null
  return raw // single object, not wrapped in array
}

/**
 * Normalize slice-prescription groups out of sliceQuantScores into a single
 * shape: an array of `{ rubric, groupScoreVariables: { scoreVariables } }`.
 *
 * Two on-disk shapes feed in:
 *   - MR: `sliceQuantScores.slicePrescription.sliceGroups[]` — already in the
 *     normalized shape, returned as-is.
 *   - CT: `sliceQuantScores.slicePrescriptionScore` — a single object with
 *     `rubric` at the root and `groupScoreVariables: [{scoreVariables: {...}}]`.
 *     Wrapped in a 1-element array so callers don't have to branch.
 *
 * Returns null when the question wasn't slice-prescription-scored
 * (sliceQuantScores has only `combinedScore`).
 */
function _readSliceGroups(rawSliceQuantScores) {
  const root = getFirstSliceQuantScore(rawSliceQuantScores)
  if (!root) return null

  const sp = root.slicePrescription
  if (sp) {
    const groups = Array.isArray(sp) ? sp : sp.sliceGroups
    if (Array.isArray(groups) && groups.length > 0) return groups
  }

  const sps = root.slicePrescriptionScore
  if (sps) {
    const gsv = sps.groupScoreVariables
    const sv = Array.isArray(gsv)
      ? gsv[0] && gsv[0].scoreVariables
      : (gsv && (gsv.scoreVariables || gsv.scoreVariable)) || null
    if (!sv) return null
    return [{ rubric: sps.rubric, groupScoreVariables: { scoreVariables: sv } }]
  }

  return null
}

/**
 * Expand angle rows.
 *
 * Modern source: `_readSliceGroups` — emits one row per slice group, gated by
 * per-group `rubric.factors.angle.ignore`. Covers MR (`slicePrescription
 * .sliceGroups[]`) and CT (`slicePrescriptionScore` wrapped to one group).
 * Rows whose `sliceQuantScores` is `combinedScore`-only are dropped.
 *
 * Legacy fallback (MR only): when `sliceQuantScores` is entirely absent,
 * expand from the outer `groupScoreVariables` array. CT rows without
 * `sliceQuantScores` are dropped — the outer GSV fallback isn't trustworthy
 * enough for the CT chart (no rubric.ignore filter on that path).
 */
function expandAngleRows(rows) {
  const allowLegacyFallback = process.env.APP_MODALITY !== 'CT'
  const expanded = []
  for (const row of rows) {
    const groups = _readSliceGroups(row.rawSliceQuantScores)

    if (groups) {
      for (const group of groups) {
        if (group?.rubric?.factors?.angle?.ignore === true) continue
        const sv = group?.groupScoreVariables?.scoreVariables
        const sliceQuantAngleOff = sv && sv.angleOff != null ? parseFloat(sv.angleOff) : null
        if (sliceQuantAngleOff == null) continue
        expanded.push({
          createdAt: row.createdAt,
          questionSetResultId: row.questionSetResultId,
          bodyPart: row.bodyPart,
          bodyPartId: row.bodyPartId,
          sliceQuantAngleOff,
          'questionSetResult.userId': row['questionSetResult.userId'],
          questionOrder: row.questionOrder,
          preparedExamId: row.preparedExamId,
        })
      }
      continue
    }

    // Skip rows where sliceQuantScores exists but has no slicePrescription.
    if (row.rawSliceQuantScores != null) continue

    // Legacy fallback (MR only): pre-sliceQuantScores records.
    if (!allowLegacyFallback) continue
    const gsv = row.groupScoreVariables
    const arr = Array.isArray(gsv) ? gsv : gsv ? [gsv] : []
    for (const elem of arr) {
      const sv = (elem && elem.scoreVariables) || {}
      const angleOff = sv.angleOff != null ? parseFloat(sv.angleOff) : null
      const angle = sv.angle != null ? parseFloat(sv.angle) : null
      const value = angleOff != null ? angleOff : angle
      if (value == null) continue
      expanded.push({
        createdAt: row.createdAt,
        questionSetResultId: row.questionSetResultId,
        bodyPart: row.bodyPart,
        bodyPartId: row.bodyPartId,
        sliceQuantAngleOff: value,
        'questionSetResult.userId': row['questionSetResult.userId'],
        questionOrder: row.questionOrder,
        preparedExamId: row.preparedExamId,
      })
    }
  }
  return expanded
}

/**
 * Expand wasted-slice rows.
 *
 * Modern source: `_readSliceGroups` — emits one row per slice group, gated by
 * per-group `rubric.factors.coverageZ.ignore`. Covers MR (`slicePrescription
 * .sliceGroups[]`) and CT (`slicePrescriptionScore` wrapped to one group).
 * Rows whose `sliceQuantScores` is `combinedScore`-only are dropped.
 *
 * Legacy fallback (MR only): when `sliceQuantScores` is entirely absent,
 * expand from the outer `groupScoreVariables` array. CT rows without
 * `sliceQuantScores` are dropped — the outer GSV fallback isn't trustworthy
 * enough for the CT chart (no rubric.ignore filter on that path).
 */
function expandWastedSlicesRows(rows) {
  const allowLegacyFallback = process.env.APP_MODALITY !== 'CT'
  const expanded = []
  for (const row of rows) {
    const groups = _readSliceGroups(row.rawSliceQuantScores)

    if (groups) {
      for (const group of groups) {
        if (group?.rubric?.factors?.coverageZ?.ignore === true) continue
        const sv = group?.groupScoreVariables?.scoreVariables
        const sliceCoverageZTooLow = sv && sv.coverageZTooLow != null ? parseFloat(sv.coverageZTooLow) : null
        const sliceCoverageZTooHigh = sv && sv.coverageZTooHigh != null ? parseFloat(sv.coverageZTooHigh) : null
        if (sliceCoverageZTooLow == null || sliceCoverageZTooHigh == null) continue
        expanded.push({
          createdAt: row.createdAt,
          questionSetResultId: row.questionSetResultId,
          bodyPart: row.bodyPart,
          bodyPartId: row.bodyPartId,
          sliceCoverageZTooLow,
          sliceCoverageZTooHigh,
          answer: row.answer,
          'questionSetResult.userId': row['questionSetResult.userId'],
          questionOrder: row.questionOrder,
          preparedExamId: row.preparedExamId,
        })
      }
      continue
    }

    // Skip rows where sliceQuantScores exists but has no slicePrescription.
    if (row.rawSliceQuantScores != null) continue

    // Legacy fallback (MR only): pre-sliceQuantScores records.
    if (!allowLegacyFallback) continue
    const gsv = row.groupScoreVariables
    const arr = Array.isArray(gsv) ? gsv : gsv ? [gsv] : []
    for (const elem of arr) {
      const sv = (elem && elem.scoreVariables) || {}
      const low = sv.coverageZTooLow != null ? parseFloat(sv.coverageZTooLow) : null
      const high = sv.coverageZTooHigh != null ? parseFloat(sv.coverageZTooHigh) : null
      if (low == null || high == null) continue
      expanded.push({
        createdAt: row.createdAt,
        questionSetResultId: row.questionSetResultId,
        bodyPart: row.bodyPart,
        bodyPartId: row.bodyPartId,
        sliceCoverageZTooLow: low,
        sliceCoverageZTooHigh: high,
        answer: row.answer,
        'questionSetResult.userId': row['questionSetResult.userId'],
        questionOrder: row.questionOrder,
        preparedExamId: row.preparedExamId,
      })
    }
  }
  return expanded
}

/**
 * Direct single-user SQL for angle data — bypasses CTE overhead.
 *
 * Modern branch expands `sliceQuantScores.slicePrescription` (an array of
 * slice-group objects), emitting one row per group. Per-group ignore flag
 * `rubric.factors.angle.ignore` filters out groups not graded on angle, and
 * each group's `groupScoreVariables.scoreVariables.angleOff` supplies the
 * value. Rows whose sliceQuantScores lacks `slicePrescription` are dropped.
 * MR-only legacy branch (skipped when APP_MODALITY=CT) expands the outer
 * `groupScoreVariables` via LATERAL jsonb_array_elements for rows with no
 * `sliceQuantScores` at all.
 *
 * @param {string|number} userId
 * @param {string} region - 'us_east' or 'eu_west'
 * @param {string[]|null} bodyParts - optional body part name filter
 * @returns {string} raw SQL
 */
const getDirectAngleSql = (userId, region, bodyParts) => {
  const uid = parseInt(userId, 10)
  if (isNaN(uid)) throw new Error('Invalid userId')

  const s = region === 'eu_west' ? '"eu_west_server_public".' : ''

  const bodyPartFilter =
    bodyParts && bodyParts.length > 0
      ? `AND bp."name" IN (${bodyParts.map((bp) => `'${bp.replace(/'/g, "''")}'`).join(', ')})`
      : ''

  // Two source paths:
  //   (a) modern rows with sliceQuantScores.slicePrescription: expand the
  //       slice-group array, drop groups with angle.ignore = true, take the
  //       group's scoreVariables.angleOff.
  //   (b) MR-only legacy rows without sliceQuantScores at all: expand the
  //       outer groupScoreVariables, taking angleOff (falling back to angle).
  //       Skipped on CT.
  const allowLegacyFallback = process.env.APP_MODALITY !== 'CT'
  const legacyBranch = allowLegacyFallback
    ? `
    UNION ALL

    SELECT
      qsr."createdAt"                                                      AS "createdAt",
      qsr."id"                                                             AS "questionSetResultId",
      bp."name"                                                            AS "bodyPart",
      bp."id"                                                              AS "bodyPartId",
      COALESCE(
        (gsv_elem.value -> 'scoreVariables' ->> 'angleOff')::float,
        (gsv_elem.value -> 'scoreVariables' ->> 'angle')::float
      )                                                                    AS "sliceQuantAngleOff",
      qsr."userId"                                                         AS "questionSetResult.userId",
      sq."order"                                                           AS "questionOrder",
      tr."preparedExamId"                                                  AS "preparedExamId"
    FROM ${s}"StackQuestionResults" sqr
    INNER JOIN ${s}"QuestionSetResults" qsr
      ON sqr."questionSetResultId" = qsr."id"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN ${s}"TestRuns" tr
      ON qsr."testRunId" = tr."id"
    LEFT JOIN "StackQuestions" sq
      ON sqr."stackQuestionId" = sq."id"
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(sqr."groupScoreVariables"::jsonb) = 'array'
          THEN sqr."groupScoreVariables"::jsonb
        ELSE jsonb_build_array(sqr."groupScoreVariables"::jsonb)
      END
    ) AS gsv_elem(value)
    WHERE qsr."userId" = ${uid}
      AND sqr."score" IS NOT NULL
      AND sqr."sliceQuantScores" IS NULL
      AND sqr."groupScoreVariables" IS NOT NULL
      AND tr."isSandbox" = false
      ${bodyPartFilter}`
    : ''

  return `
    SELECT
      qsr."createdAt"                                                      AS "createdAt",
      qsr."id"                                                             AS "questionSetResultId",
      bp."name"                                                            AS "bodyPart",
      bp."id"                                                              AS "bodyPartId",
      (sg.value -> 'groupScoreVariables' -> 'scoreVariables' ->> 'angleOff')::float
                                                                           AS "sliceQuantAngleOff",
      qsr."userId"                                                         AS "questionSetResult.userId",
      sq."order"                                                           AS "questionOrder",
      tr."preparedExamId"                                                  AS "preparedExamId"
    FROM ${s}"StackQuestionResults" sqr
    INNER JOIN ${s}"QuestionSetResults" qsr
      ON sqr."questionSetResultId" = qsr."id"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN ${s}"TestRuns" tr
      ON qsr."testRunId" = tr."id"
    LEFT JOIN "StackQuestions" sq
      ON sqr."stackQuestionId" = sq."id"
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN jsonb_typeof(sqr."sliceQuantScores"::jsonb) = 'array'
          THEN sqr."sliceQuantScores"::jsonb -> 0
        ELSE sqr."sliceQuantScores"::jsonb
      END AS root
    ) sqs
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(sqs.root -> 'slicePrescription' -> 'sliceGroups') = 'array'
          THEN sqs.root -> 'slicePrescription' -> 'sliceGroups'
        WHEN jsonb_typeof(sqs.root -> 'slicePrescription') = 'array'
          THEN sqs.root -> 'slicePrescription'
        WHEN sqs.root -> 'slicePrescriptionScore' IS NOT NULL
          THEN jsonb_build_array(jsonb_build_object(
            'rubric', sqs.root -> 'slicePrescriptionScore' -> 'rubric',
            'groupScoreVariables', jsonb_build_object(
              'scoreVariables', COALESCE(
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 0 -> 'scoreVariables',
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 'scoreVariables',
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 'scoreVariable'
              )
            )
          ))
        ELSE '[]'::jsonb
      END
    ) AS sg(value)
    WHERE qsr."userId" = ${uid}
      AND sqr."score" IS NOT NULL
      AND sqr."sliceQuantScores" IS NOT NULL
      AND tr."isSandbox" = false
      AND (
        jsonb_typeof(sqs.root -> 'slicePrescription' -> 'sliceGroups') = 'array'
        OR jsonb_typeof(sqs.root -> 'slicePrescription') = 'array'
        OR sqs.root -> 'slicePrescriptionScore' IS NOT NULL
      )
      AND COALESCE((sg.value -> 'rubric' -> 'factors' -> 'angle' ->> 'ignore')::boolean, true) = false
      ${bodyPartFilter}
    ${legacyBranch}

    ORDER BY 1, 7, 2
  `
}

/**
 * Direct single-user SQL for wasted-slices data — bypasses CTE overhead.
 *
 * Modern branch expands `sliceQuantScores.slicePrescription` (an array of
 * slice-group objects), emitting one row per group. Per-group ignore flag
 * `rubric.factors.coverageZ.ignore` filters out groups not graded on slice
 * coverage, and each group's `groupScoreVariables.scoreVariables` supplies
 * `coverageZTooLow/High`. Rows whose sliceQuantScores lacks `slicePrescription`
 * are dropped. MR-only legacy branch (skipped when APP_MODALITY=CT) expands
 * the outer `groupScoreVariables` via LATERAL jsonb_array_elements for rows
 * with no `sliceQuantScores` at all. Answer spacing/thickness are extracted
 * as scalars.
 *
 * @param {string|number} userId
 * @param {string} region - 'us_east' or 'eu_west'
 * @param {string[]|null} bodyParts - optional body part name filter
 * @returns {string} raw SQL
 */
const getDirectWastedSlicesSql = (userId, region, bodyParts) => {
  const uid = parseInt(userId, 10)
  if (isNaN(uid)) throw new Error('Invalid userId')

  const s = region === 'eu_west' ? '"eu_west_server_public".' : ''

  const bodyPartFilter =
    bodyParts && bodyParts.length > 0
      ? `AND bp."name" IN (${bodyParts.map((bp) => `'${bp.replace(/'/g, "''")}'`).join(', ')})`
      : ''

  // Two source paths:
  //   (a) modern rows with sliceQuantScores.slicePrescription: expand the
  //       slice-group array, drop groups with coverageZ.ignore = true, take
  //       the group's scoreVariables.coverageZTooLow/High.
  //   (b) MR-only legacy rows without sliceQuantScores at all: expand the
  //       outer groupScoreVariables. Skipped on CT — the outer GSV fallback
  //       isn't trustworthy enough for the CT chart.
  const allowLegacyFallback = process.env.APP_MODALITY !== 'CT'
  const legacyBranch = allowLegacyFallback
    ? `
    UNION ALL

    SELECT
      qsr."createdAt"                                                      AS "createdAt",
      qsr."id"                                                             AS "questionSetResultId",
      bp."name"                                                            AS "bodyPart",
      bp."id"                                                              AS "bodyPartId",
      (gsv_elem.value -> 'scoreVariables' ->> 'coverageZTooLow')::float    AS "sliceCoverageZTooLow",
      (gsv_elem.value -> 'scoreVariables' ->> 'coverageZTooHigh')::float   AS "sliceCoverageZTooHigh",
      (sqr."answer"::jsonb -> 0 ->> 'spacing')::float                     AS "answerSpacing",
      (sqr."answer"::jsonb -> 0 ->> 'thickness')::float                   AS "answerThickness",
      qsr."userId"                                                         AS "questionSetResult.userId",
      sq."order"                                                           AS "questionOrder",
      tr."preparedExamId"                                                  AS "preparedExamId"
    FROM ${s}"StackQuestionResults" sqr
    INNER JOIN ${s}"QuestionSetResults" qsr
      ON sqr."questionSetResultId" = qsr."id"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN ${s}"TestRuns" tr
      ON qsr."testRunId" = tr."id"
    LEFT JOIN "StackQuestions" sq
      ON sqr."stackQuestionId" = sq."id"
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(sqr."groupScoreVariables"::jsonb) = 'array'
          THEN sqr."groupScoreVariables"::jsonb
        ELSE jsonb_build_array(sqr."groupScoreVariables"::jsonb)
      END
    ) AS gsv_elem(value)
    WHERE qsr."userId" = ${uid}
      AND sqr."score" IS NOT NULL
      AND sqr."sliceQuantScores" IS NULL
      AND sqr."groupScoreVariables" IS NOT NULL
      AND tr."isSandbox" = false
      ${bodyPartFilter}`
    : ''

  return `
    SELECT
      qsr."createdAt"                                                      AS "createdAt",
      qsr."id"                                                             AS "questionSetResultId",
      bp."name"                                                            AS "bodyPart",
      bp."id"                                                              AS "bodyPartId",
      (sg.value -> 'groupScoreVariables' -> 'scoreVariables' ->> 'coverageZTooLow')::float
                                                                           AS "sliceCoverageZTooLow",
      (sg.value -> 'groupScoreVariables' -> 'scoreVariables' ->> 'coverageZTooHigh')::float
                                                                           AS "sliceCoverageZTooHigh",
      (sqr."answer"::jsonb -> 0 ->> 'spacing')::float                     AS "answerSpacing",
      (sqr."answer"::jsonb -> 0 ->> 'thickness')::float                   AS "answerThickness",
      qsr."userId"                                                         AS "questionSetResult.userId",
      sq."order"                                                           AS "questionOrder",
      tr."preparedExamId"                                                  AS "preparedExamId"
    FROM ${s}"StackQuestionResults" sqr
    INNER JOIN ${s}"QuestionSetResults" qsr
      ON sqr."questionSetResultId" = qsr."id"
    INNER JOIN "QuestionSets" qs
      ON qsr."questionSetId" = qs."id"
    INNER JOIN "BodyParts" bp
      ON qs."bodyPartId" = bp."id"
    INNER JOIN ${s}"TestRuns" tr
      ON qsr."testRunId" = tr."id"
    LEFT JOIN "StackQuestions" sq
      ON sqr."stackQuestionId" = sq."id"
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN jsonb_typeof(sqr."sliceQuantScores"::jsonb) = 'array'
          THEN sqr."sliceQuantScores"::jsonb -> 0
        ELSE sqr."sliceQuantScores"::jsonb
      END AS root
    ) sqs
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(sqs.root -> 'slicePrescription' -> 'sliceGroups') = 'array'
          THEN sqs.root -> 'slicePrescription' -> 'sliceGroups'
        WHEN jsonb_typeof(sqs.root -> 'slicePrescription') = 'array'
          THEN sqs.root -> 'slicePrescription'
        WHEN sqs.root -> 'slicePrescriptionScore' IS NOT NULL
          THEN jsonb_build_array(jsonb_build_object(
            'rubric', sqs.root -> 'slicePrescriptionScore' -> 'rubric',
            'groupScoreVariables', jsonb_build_object(
              'scoreVariables', COALESCE(
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 0 -> 'scoreVariables',
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 'scoreVariables',
                sqs.root -> 'slicePrescriptionScore' -> 'groupScoreVariables' -> 'scoreVariable'
              )
            )
          ))
        ELSE '[]'::jsonb
      END
    ) AS sg(value)
    WHERE qsr."userId" = ${uid}
      AND sqr."score" IS NOT NULL
      AND sqr."sliceQuantScores" IS NOT NULL
      AND tr."isSandbox" = false
      AND (
        jsonb_typeof(sqs.root -> 'slicePrescription' -> 'sliceGroups') = 'array'
        OR jsonb_typeof(sqs.root -> 'slicePrescription') = 'array'
        OR sqs.root -> 'slicePrescriptionScore' IS NOT NULL
      )
      AND COALESCE((sg.value -> 'rubric' -> 'factors' -> 'coverageZ' ->> 'ignore')::boolean, true) = false
      ${bodyPartFilter}
    ${legacyBranch}

    ORDER BY 1, 10, 2
  `
}

const StatisticService = {
  getTestRunAndGroupStackQuestionResultForMultipleUsers,
  getTestRunAndGroupStackQuestionResultForOneUser,
  getStatisticWastedSlicesOfMultiUserSql,
  getStatisticFactorAngleOfMultiUserSql,
  getCombinedAngleAndWastedSlicesOfMultiUserSql,
  getStatisticTestSql,
  getStatisticFactorWastedSlicesSql,
  getStatisticFactorAngleSql,
  getDirectAngleSql,
  getDirectWastedSlicesSql,
  getStatisticSql,
  getStatisticBestSql,
  getExportDataSql,
  getMCAverageSql,
  getQueryAllStackQuestionResultEUWestSql,
  getQueryAllStackQuestionResultUSEastSql,
  getQueryTestRunInUsEastsSql,
  getQueryTestRunInEUWestsSql,
  getStatisticMcWhomSql,
  getCommentFlagsUSEast,
  getCommentFlagsEUWest,
  expandAngleRows,
  expandWastedSlicesRows,
  getFirstSliceQuantScore,
  buildPaginationClause,
}

module.exports = StatisticService
