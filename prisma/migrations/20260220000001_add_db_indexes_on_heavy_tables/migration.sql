-- Performance: Add missing indexes on high-traffic tables.
-- NOTE: For production databases with large tables, consider running these
-- statements manually with CREATE INDEX CONCURRENTLY to avoid table locks.

-- CreateIndex: CohortStudents(cohortId) — speeds up "find all students in a cohort" queries
CREATE INDEX "cohort_students_cohort_id" ON "CohortStudents"("cohortId");

-- CreateIndex: CohortStudents(userId) — speeds up "find all cohorts a user belongs to"
CREATE INDEX "cohort_students_user_id" ON "CohortStudents"("userId");

-- CreateIndex: CohortStudents(cohortId, userId) — composite for membership checks
CREATE INDEX "cohort_students_cohort_id_user_id" ON "CohortStudents"("cohortId", "userId");

-- CreateIndex: QuestionSetResults(userId) — primary lookup: all results for a user
CREATE INDEX "question_set_results_user_id" ON "QuestionSetResults"("userId");

-- CreateIndex: QuestionSetResults(testRunId) — join from a TestRun to its results
CREATE INDEX "question_set_results_test_run_id" ON "QuestionSetResults"("testRunId");

-- CreateIndex: QuestionSetResults(questionSetId) — filter results by question set
CREATE INDEX "question_set_results_question_set_id" ON "QuestionSetResults"("questionSetId");

-- CreateIndex: StackQuestionResults(questionSetResultId) — load all SQRs within a QSR
CREATE INDEX "stack_question_results_qsr_id" ON "StackQuestionResults"("questionSetResultId");

-- CreateIndex: StackQuestionResults(stackQuestionId) — find results for a specific question
CREATE INDEX "stack_question_results_sq_id" ON "StackQuestionResults"("stackQuestionId");

-- CreateIndex: StackQuestionResultComments(stackQuestionResultId) — load comments per SQR
CREATE INDEX "sqr_comments_sqr_id" ON "StackQuestionResultComments"("stackQuestionResultId");

-- CreateIndex: TestRuns(userId) — primary lookup: all test runs for a user
CREATE INDEX "test_runs_user_id" ON "TestRuns"("userId");
