const getQueryStackQuestionResultSql = (modelProvider) => {
  const sql = `
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
                'id', cu.id,
                'legalName', COALESCE (cuui."legalName", cuuei."legalName", 'N/A')
                ),
                'viewedUser', json_build_object(
                'id', vu.id,
                'legalName', COALESCE (vuui."legalName", vuuei."legalName", 'N/A')
                )
            )
            ORDER BY sqrc."createdAt" ASC
            ) FILTER (WHERE sqrc.id IS NOT NULL),
            '[]'
        ) AS "stackQuestionResultComments"
        FROM "${modelProvider.StackQuestionResult._schema || 'public'}"."${
    modelProvider.StackQuestionResult.tableName
  }" sqr
            LEFT JOIN "${modelProvider.StackQuestionResultComment._schema || 'public'}"."${
    modelProvider.StackQuestionResultComment.tableName
  }" sqrc
        ON sqr.id = sqrc."stackQuestionResultId"
        LEFT JOIN "Users" cu
        ON sqrc."commentedUserId" = cu.id
        LEFT JOIN "Users" vu
        ON sqrc."viewedUserId" = vu.id
        LEFT JOIN "public"."UserInformations" cuui 
        ON cuui."userId" = "cu"."id"
        LEFT JOIN "eu_west_server_public"."UserInformations" cuuei 
        ON cuuei."userId" = "cu"."id"
        LEFT JOIN "public"."UserInformations" vuui 
        ON vuui."userId" = "vu"."id"
        LEFT JOIN "eu_west_server_public"."UserInformations" vuuei 
        ON vuuei."userId" = "vu"."id"
        WHERE sqr."questionSetResultId" = :questionSetResultId
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
    `

  return sql
}

const getQueryQuestionSetSql = (modelProvider) => {
  const sql = `SELECT 
      "QuestionSetResult".*, 
      json_build_object(
        'id', "user"."id",
        'legalName', COALESCE (ui."legalName", uei."legalName", 'N/A')
      ) AS "user"
    FROM "${modelProvider.QuestionSetResult._schema || 'public'}"."${
    modelProvider.QuestionSetResult.tableName
  }" "QuestionSetResult"
    INNER JOIN "Users" "user"
      ON "QuestionSetResult"."userId" = "user"."id"
    LEFT JOIN "public"."UserInformations" ui 
      ON ui."userId" = "user"."id"
    LEFT JOIN "eu_west_server_public"."UserInformations" uei 
      ON uei."userId" = "user"."id"
    WHERE "QuestionSetResult"."id" = :id
    `

  return sql
}

const getQueryMultipleChoiceQuestionResultSql = (modelProvider) => {
  return `
      SELECT
        mqr."id",
        mqr."score",
        mqr."answer",
        mcq."id" AS "questionId",
        mcq."questionText" AS "text",
        mcq."choices" AS "choices",
        mcq."range" AS "range",
        mcq."type" AS "type",
        mcq."answerExplanation" AS "answerExplanation",
        mcq."screeningForm" AS "screeningForm",
        mcq."isBetaQuestion" AS "isBetaQuestion",
        json_build_object(
          'id', mcq."id",
          'questionText', mcq."questionText",
          'hideQuestion', mcq."hideQuestion",
          'bodyPartId', mcq."bodyPartId",
          'categoryId', mcq."categoryId",
          'type', mcq."type",
          'isBetaQuestion', mcq."isBetaQuestion",
          'betaQuestionAttempts', mcq."betaQuestionAttempts",
          'globalQuestion', mcq."globalQuestion",
          'onlyForPreparedExams', mcq."onlyForPreparedExams",
          'choices', mcq."choices",
          'range', mcq."range",
          'answerExplanation', mcq."answerExplanation",
          'screeningForm', mcq."screeningForm",
          'category', json_build_object(
            'id', cat."id",
            'name', cat."name"
          )
        ) AS "multipleChoiceQuestion"
      FROM "${modelProvider.MultipleChoiceQuestionResult._schema || 'public'}"."${
    modelProvider.MultipleChoiceQuestionResult.tableName
  }" mqr
      INNER JOIN "MultipleChoiceQuestions" mcq
        ON mqr."multipleChoiceQuestionId" = mcq."id"
      LEFT JOIN "public"."Categories" cat
        ON mcq."categoryId" = cat."id"
      WHERE mqr."testRunId" = :testRunId
    `
}

const QuestionSetResultService = {
  getQueryStackQuestionResultSql,
  getQueryQuestionSetSql,
  getQueryMultipleChoiceQuestionResultSql,
}

module.exports = QuestionSetResultService
