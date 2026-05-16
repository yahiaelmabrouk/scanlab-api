const {
  TestRun,
  QuestionSetResult,
  StackQuestionResult,
  StackQuestionResultComment,
  MultipleChoiceQuestionResult,
  TestRunEuWest,
  QuestionSetResultEuWest,
  StackQuestionResultEuWest,
  StackQuestionResultCommentEuWest,
  MultipleChoiceQuestionResultEuWest,
  UserInformation,
  UserInformationEuWest,
} = require('../../db/models')
const { USER_AREA } = require('../../util/constants')
const { whereObjectToSql } = require('../../util/sql')
const { getMineCohortArea, getCohortArea } = require('../api_util/api_util')

const schemas = [
  { name: 'public', aliasPrefix: 'public' },
  { name: 'eu_west_server_public', aliasPrefix: 'eu_west_server_public' },
]

const tables = [
  {
    cteName: 'CombinedMultipleChoiceQuestionResults',
    tableName: 'MultipleChoiceQuestionResults',
    alias: 'mcq',
    fields: [
      { name: 'id', expression: (schema, alias) => `${alias}.id` },
      { name: 'answer', expression: (schema, alias) => `${alias}."answer"` },
      { name: 'createdAt', expression: (schema, alias) => `${alias}."createdAt"` },
      { name: 'updatedAt', expression: (schema, alias) => `${alias}."updatedAt"` },
      { name: 'userId', expression: (schema, alias) => `${alias}."userId"` },
      { name: 'multipleChoiceQuestionId', expression: (schema, alias) => `${alias}."multipleChoiceQuestionId"` },
      { name: 'testRunId', expression: (schema, alias) => `${alias}."testRunId"` },
      { name: 'score', expression: (schema, alias) => `${alias}."score"` },
    ],
    combinedFields: [
      { name: 'combinedId', expression: (schema, alias) => `'${schema}' || ${alias}.id` },
      { name: 'combinedTestRunId', expression: (schema, alias) => `'${schema}' || ${alias}."testRunId"` },
    ],
  },
  {
    cteName: 'CombinedQuestionSetResults',
    tableName: 'QuestionSetResults',
    alias: 'qsr',
    fields: [
      { name: 'id', expression: (schema, alias) => `${alias}.id` },
      { name: 'score', expression: (schema, alias) => `${alias}."score"` },
      { name: 'sliceQuantScore', expression: (schema, alias) => `${alias}."sliceQuantScore"` },
      { name: 'overallSkillScores', expression: (schema, alias) => `${alias}."overallSkillScores"` },
      { name: 'createdAt', expression: (schema, alias) => `${alias}."createdAt"` },
      { name: 'updatedAt', expression: (schema, alias) => `${alias}."updatedAt"` },
      { name: 'isViewedAdminComment', expression: (schema, alias) => `${alias}."isViewedAdminComment"` },
      { name: 'isViewedUserReply', expression: (schema, alias) => `${alias}."isViewedUserReply"` },
      { name: 'isViewedAdminReply', expression: (schema, alias) => `${alias}."isViewedAdminReply"` },
      { name: 'userId', expression: (schema, alias) => `${alias}."userId"` },
      { name: 'questionSetId', expression: (schema, alias) => `${alias}."questionSetId"` },
      { name: 'testRunId', expression: (schema, alias) => `${alias}."testRunId"` },
      { name: 'isChallengeMode', expression: (schema, alias) => `${alias}."isChallengeMode"` },
    ],
    combinedFields: [
      { name: 'combinedId', expression: (schema, alias) => `'${schema}' || ${alias}.id` },
      { name: 'combinedTestRunId', expression: (schema, alias) => `'${schema}' || ${alias}."testRunId"` },
    ],
  },
  {
    cteName: 'CombinedTestRuns',
    tableName: 'TestRuns',
    alias: 'tr',
    fields: [
      { name: 'id', expression: (schema, alias) => `${alias}.id` },
      { name: 'userId', expression: (schema, alias) => `${alias}."userId"` },
      { name: 'questions', expression: (schema, alias) => `${alias}."questions"` },
      { name: 'answers', expression: (schema, alias) => `${alias}."answers"` },
      { name: 'secondsActive', expression: (schema, alias) => `${alias}."secondsActive"` },
      { name: 'timeStarted', expression: (schema, alias) => `${alias}."timeStarted"` },
      { name: 'timeEnded', expression: (schema, alias) => `${alias}."timeEnded"` },
      { name: 'createdAt', expression: (schema, alias) => `${alias}."createdAt"` },
      { name: 'updatedAt', expression: (schema, alias) => `${alias}."updatedAt"` },
      { name: 'score', expression: (schema, alias) => `${alias}."score"` },
      { name: 'patientPrepScore', expression: (schema, alias) => `${alias}."patientPrepScore"` },
      { name: 'patientPrepScores', expression: (schema, alias) => `${alias}."patientPrepScores"` },
      { name: 'questionSetScore', expression: (schema, alias) => `${alias}."questionSetScore"` },
      { name: 'isSandbox', expression: (schema, alias) => `${alias}."isSandbox"` },
      { name: 'preparedExamId', expression: (schema, alias) => `${alias}."preparedExamId"` },
      { name: 'bodyPartId', expression: (schema, alias) => `${alias}."bodyPartId"` },
      { name: 'softwareVendor', expression: (schema, alias) => `${alias}."softwareVendor"` },
      { name: 'softwareVersion', expression: (schema, alias) => `${alias}."softwareVersion"` },
    ],
    combinedFields: [{ name: 'combinedId', expression: (schema, alias) => `'${schema}' || ${alias}.id` }],
  },
  {
    cteName: 'CombinedStackQuestionResults',
    tableName: 'StackQuestionResults',
    alias: 'sqr',
    fields: [
      { name: 'id', expression: (schema, alias) => `${alias}."id"` },
      { name: 'score', expression: (schema, alias) => `${alias}."score"` },
      { name: 'attemptedAnswerIdentifier', expression: (schema, alias) => `${alias}."attemptedAnswerIdentifier"` },
      { name: 'createdAt', expression: (schema, alias) => `${alias}."createdAt"` },
      { name: 'updatedAt', expression: (schema, alias) => `${alias}."updatedAt"` },
      { name: 'answer', expression: (schema, alias) => `${alias}."answer"` },
      { name: 'comment', expression: (schema, alias) => `${alias}."comment"` },
      { name: 'commentCreatedAt', expression: (schema, alias) => `${alias}."commentCreatedAt"` },
      { name: 'commentedUserId', expression: (schema, alias) => `${alias}."commentedUserId"` },
      { name: 'commentSeenAt', expression: (schema, alias) => `${alias}."commentSeenAt"` },
      { name: 'isViewedAdminComment', expression: (schema, alias) => `${alias}."isViewedAdminComment"` },
      { name: 'reply', expression: (schema, alias) => `${alias}."reply"` },
      { name: 'replyCreatedAt', expression: (schema, alias) => `${alias}."replyCreatedAt"` },
      { name: 'replySeenAt', expression: (schema, alias) => `${alias}."replySeenAt"` },
      { name: 'isViewedUserReply', expression: (schema, alias) => `${alias}."isViewedUserReply"` },
      { name: 'adminReply', expression: (schema, alias) => `${alias}."adminReply"` },
      { name: 'adminReplyCreatedAt', expression: (schema, alias) => `${alias}."adminReplyCreatedAt"` },
      { name: 'adminRepliedUserId', expression: (schema, alias) => `${alias}."adminRepliedUserId"` },
      { name: 'adminReplySeenAt', expression: (schema, alias) => `${alias}."adminReplySeenAt"` },
      { name: 'isViewedAdminReply', expression: (schema, alias) => `${alias}."isViewedAdminReply"` },
      { name: 'questionSetResultId', expression: (schema, alias) => `${alias}."questionSetResultId"` },
      { name: 'stackQuestionId', expression: (schema, alias) => `${alias}."stackQuestionId"` },
      { name: 'skillScores', expression: (schema, alias) => `${alias}."skillScores"` },
      { name: 'groupScoreVariables', expression: (schema, alias) => `${alias}."groupScoreVariables"` },
      { name: 'sliceQuantScores', expression: (schema, alias) => `${alias}."sliceQuantScores"` },
      { name: 'sliceViews', expression: (schema, alias) => `${alias}."sliceViews"` },
      { name: 'answerViews', expression: (schema, alias) => `${alias}."answerViews"` },
      { name: 'skipped', expression: (schema, alias) => `${alias}."skipped"` },
      { name: 'freebie', expression: (schema, alias) => `${alias}."freebie"` },
    ],
    combinedFields: [
      { name: 'combinedId', expression: (schema, alias) => `'${schema}' || ${alias}.id` },
      {
        name: 'combinedQuestionSetResultIdId',
        expression: (schema, alias) => `'${schema}' || ${alias}."questionSetResultId"`,
      },
    ],
  },
  {
    cteName: 'CombinedStackQuestionResultComments',
    tableName: 'StackQuestionResultComments',
    alias: 'sqrc',
    fields: [
      { name: 'id', expression: (schema, alias) => `${alias}.id` },
      { name: 'comment', expression: (schema, alias) => `${alias}.comment` },
      { name: 'seen', expression: (schema, alias) => `${alias}.seen` },
      { name: 'seenAt', expression: (schema, alias) => `${alias}.seenAt` },
      { name: 'createdAt', expression: (schema, alias) => `${alias}."createdAt"` },
      { name: 'lastedUpdatedAt', expression: (schema, alias) => `${alias}."lastedUpdatedAt"` },
      { name: 'updatedAt', expression: (schema, alias) => `${alias}."updatedAt"` },
      { name: 'commentedUserId', expression: (schema, alias) => `${alias}."commentedUserId"` },
      { name: 'viewedUserId', expression: (schema, alias) => `${alias}."viewedUserId"` },
      { name: 'stackQuestionResultId', expression: (schema, alias) => `${alias}."stackQuestionResultId"` },
    ],
    combinedFields: [
      { name: 'combinedId', expression: (schema, alias) => `'${schema}' || ${alias}.id` },
      {
        name: 'combinedStackQuestionResultId',
        expression: (schema, alias) => `'${schema}' || ${alias}."stackQuestionResultId"`,
      },
    ],
  },
]

const getModelProvider = async (userId) => {
  const cohortArea = await getMineCohortArea(userId)
  if (cohortArea == USER_AREA.EU_WEST) {
    return {
      TestRun: TestRunEuWest,
      QuestionSetResult: QuestionSetResultEuWest,
      StackQuestionResult: StackQuestionResultEuWest,
      StackQuestionResultComment: StackQuestionResultCommentEuWest,
      MultipleChoiceQuestionResult: MultipleChoiceQuestionResultEuWest,
      UserInformation: UserInformationEuWest,
    }
  } else {
    return {
      TestRun,
      QuestionSetResult,
      StackQuestionResult,
      StackQuestionResultComment,
      MultipleChoiceQuestionResult,
      UserInformation,
    }
  }
}

const getModelProviderFromCohortId = async (cohortId) => {
  const cohortArea = await getCohortArea(cohortId)
  if (cohortArea == USER_AREA.EU_WEST) {
    return {
      TestRun: TestRunEuWest,
      QuestionSetResult: QuestionSetResultEuWest,
      StackQuestionResult: StackQuestionResultEuWest,
      StackQuestionResultComment: StackQuestionResultCommentEuWest,
      MultipleChoiceQuestionResult: MultipleChoiceQuestionResultEuWest,
      UserInformation: UserInformationEuWest,
    }
  } else {
    return {
      TestRun,
      QuestionSetResult,
      StackQuestionResult,
      StackQuestionResultComment,
      MultipleChoiceQuestionResult,
      UserInformation,
    }
  }
}

const findUserInfomationByEmail = async (email) => {
  const [userInformation, userInformationEuWest] = await Promise.all([
    UserInformation.findOne({ where: { email } }),
    UserInformationEuWest.findOne({ where: { email } }),
  ])
  return userInformation || userInformationEuWest
}

const findUserInfomationBySequelizeWhere = async (where) => {
  let userInformation = await UserInformation.findOne({ where })
  if (!userInformation) {
    userInformation = await UserInformationEuWest.findOne({ where })
  }
  return userInformation
}

/**
 * Build WITH ... AS (SELECT ... UNION ALL SELECT ...) CTEs for the given tables.
 *
 * @param {Array<{tableName:string, where?:object, subWhere?:object}>} tableNames
 * @param {object} [options]
 * @param {string} [options.region] - Optional region filter. When set to a
 *   USER_AREA value ('us_east' or 'eu_west'), only the matching schema is
 *   included in each CTE instead of UNION ALL-ing both schemas.  This avoids
 *   scanning the irrelevant schema entirely and can cut query time in half.
 */
const generateCombinedQuery = (tableNames, options = {}) => {
  const { region } = options

  // Determine which schemas to include based on region filter
  let filteredSchemas = schemas
  if (region === 'us_east') {
    filteredSchemas = schemas.filter((s) => s.name === 'public')
  } else if (region === 'eu_west') {
    filteredSchemas = schemas.filter((s) => s.name === 'eu_west_server_public')
  }

  // Build CTEs for each table
  const allTableNames = tableNames.map((table) => table.tableName)
  const ctes = tables
    .filter((el) => allTableNames.includes(el.tableName))
    .map((table) => {
      const selectStatements = filteredSchemas.map((schema, index) => {
        const alias = `${table.alias}${index + 2}` // e.g., qsr2, qsr3, qsr4
        const combinedFields = table.combinedFields
          .map((field) => `${field.expression(schema.aliasPrefix, alias)} as "${field.name}"`)
          .join(', ')
        const selectFields = table.fields.map((field) => field.expression(schema.aliasPrefix, alias)).join(', ')
        const tableObject = tableNames.find((t) => t.tableName === table.tableName)
        const tableCondition = tableObject.where ? `WHERE ${whereObjectToSql(tableObject.where, true, alias)}` : ''
        if (table.tableName == 'StackQuestionResults' && tableObject.subWhere) {
          const subTableCondition = `WHERE "${alias}"."questionSetResultId" in (SELECT id FROM "${
            schema.name
          }"."QuestionSetResults" qsrm WHERE ${whereObjectToSql(tableObject.subWhere, true, 'qsrm')})`
          return `SELECT ${selectFields}, ${combinedFields} FROM "${schema.name}"."${table.tableName}" "${alias}" ${subTableCondition}`
        } else {
          return `SELECT ${selectFields}, ${combinedFields} FROM "${schema.name}"."${table.tableName}" "${alias}" ${tableCondition}`
        }
      })
      return ` "${table.cteName}" AS (      
                ${selectStatements.join(`
                  UNION ALL
                `)}
              )`
    })

  // Combine all CTEs into the final query
  return `WITH ${ctes.join(`, `)}`
}

const ModelProvider = {
  getModelProvider,
  generateCombinedQuery,
  findUserInfomationByEmail,
  findUserInfomationBySequelizeWhere,
  getModelProviderFromCohortId,
}

module.exports = ModelProvider
