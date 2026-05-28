/**
 * Creates the eu_west_server_public schema in the local development database.
 * Run: node scripts/setup-eu-schema.js
 */
require('dotenv').config({ path: '.env.defaults' })
const { Client } = require('pg')

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: process.env.DB_PASSWORD || '123456',
    database: 'scanlab',
  })

  await client.connect()
  console.log('Connected to database')

  try {
    await client.query('BEGIN')

    await client.query('CREATE SCHEMA IF NOT EXISTS eu_west_server_public')
    console.log('Schema created')

    await client.query('SET search_path TO eu_west_server_public')

    await client.query(`
      CREATE TABLE IF NOT EXISTS "TestRuns" (
        "id" SERIAL NOT NULL,
        "userId" INTEGER,
        "questions" JSON,
        "answers" JSON,
        "secondsActive" INTEGER,
        "timeStarted" TIMESTAMPTZ(6),
        "timeEnded" TIMESTAMPTZ(6),
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "score" DECIMAL(5,2),
        "patientPrepScore" DECIMAL(5,2),
        "patientPrepScores" JSON,
        "questionSetScore" DECIMAL(5,2),
        "isSandbox" BOOLEAN NOT NULL DEFAULT false,
        "preparedExamId" INTEGER,
        "bodyPartId" INTEGER,
        "softwareVendor" VARCHAR(255),
        "softwareVersion" VARCHAR(255),
        CONSTRAINT "TestRuns_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MultipleChoiceQuestionResults" (
        "id" SERIAL NOT NULL,
        "answer" TEXT,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" INTEGER NOT NULL,
        "multipleChoiceQuestionId" INTEGER NOT NULL,
        "testRunId" INTEGER,
        "score" DECIMAL(5,2) NOT NULL,
        CONSTRAINT "MultipleChoiceQuestionResults_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "StackQuestionResults" (
        "id" SERIAL NOT NULL,
        "score" DECIMAL(5,2),
        "attemptedAnswerIdentifier" VARCHAR(255),
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "answer" JSON,
        "comment" TEXT DEFAULT '',
        "commentCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "commentedUserId" INTEGER,
        "commentSeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "isViewedAdminComment" BOOLEAN DEFAULT true,
        "reply" TEXT DEFAULT '',
        "replyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "replySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "isViewedUserReply" BOOLEAN DEFAULT true,
        "adminReply" TEXT DEFAULT '',
        "adminReplyCreatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "adminRepliedUserId" INTEGER,
        "adminReplySeenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "isViewedAdminReply" BOOLEAN DEFAULT true,
        "questionSetResultId" INTEGER,
        "stackQuestionId" INTEGER,
        "skillScores" JSONB,
        "groupScoreVariables" JSONB,
        "sliceQuantScores" JSONB,
        "sliceViews" JSONB,
        "answerViews" JSONB,
        "skipped" BOOLEAN,
        "freebie" BOOLEAN,
        CONSTRAINT "StackQuestionResults_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "StackQuestionResultComments" (
        "id" SERIAL NOT NULL,
        "comment" TEXT DEFAULT '',
        "seen" BOOLEAN DEFAULT true,
        "seenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastedUpdatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "commentedUserId" INTEGER,
        "viewedUserId" INTEGER,
        "stackQuestionResultId" INTEGER NOT NULL,
        CONSTRAINT "StackQuestionResultComments_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "QuestionSetResults" (
        "id" SERIAL NOT NULL,
        "score" DECIMAL(5,2),
        "sliceQuantScore" DECIMAL(5,2),
        "overallSkillScores" JSON,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isViewedAdminComment" BOOLEAN DEFAULT true,
        "isViewedUserReply" BOOLEAN DEFAULT true,
        "isViewedAdminReply" BOOLEAN DEFAULT true,
        "userId" INTEGER NOT NULL,
        "questionSetId" INTEGER,
        "testRunId" INTEGER,
        "isChallengeMode" BOOLEAN,
        CONSTRAINT "QuestionSetResults_pkey" PRIMARY KEY ("id")
      )
    `)

    // Add foreign keys (ignore if already exist)
    const fkQueries = [
      `ALTER TABLE "MultipleChoiceQuestionResults" ADD CONSTRAINT "MCQ_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      `ALTER TABLE "StackQuestionResultComments" ADD CONSTRAINT "SQRC_sqrId_fkey" FOREIGN KEY ("stackQuestionResultId") REFERENCES "StackQuestionResults"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "StackQuestionResults" ADD CONSTRAINT "SQR_qsrId_fkey" FOREIGN KEY ("questionSetResultId") REFERENCES "QuestionSetResults"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "QuestionSetResults" ADD CONSTRAINT "QSR_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRuns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    ]
    for (const fk of fkQueries) {
      try { await client.query(fk) } catch (e) { /* ignore duplicate constraint */ }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserInformations" (
        "id" SERIAL NOT NULL,
        "userId" INTEGER NOT NULL,
        "vendorStylePreference" VARCHAR(255),
        "fieldStrengthPreference" VARCHAR(255),
        "defaultLanguageCode" TEXT DEFAULT 'en',
        "softwareVendorPreference" VARCHAR(255),
        "softwareVersionPreference" VARCHAR(255),
        "isAdmin" BOOLEAN,
        "passHash" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "legalName" VARCHAR(255) NOT NULL,
        "nickName" VARCHAR(255),
        "language" VARCHAR(255),
        "lastIP" VARCHAR(255),
        "minJWTGeneratedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "injectionMode" INTEGER NOT NULL DEFAULT 2,
        "injectCondition" INTEGER NOT NULL DEFAULT 1,
        "defaultContrastOnlyProtocol" INTEGER NOT NULL DEFAULT 2,
        "defaultContrastAndSalineProtocol" INTEGER NOT NULL DEFAULT 1,
        "sliceExpansionBehavior" INTEGER NOT NULL DEFAULT 1,
        "preferredAnswerCriteriaByStackQuestionId" JSONB,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastIPs" JSONB DEFAULT '[]',
        "sliceFrameRate" VARCHAR(255),
        "scientificMode" JSONB,
        "preferredTimingMethod" VARCHAR(20),
        "settings" JSONB NOT NULL DEFAULT '{}',
        CONSTRAINT "UserInformations_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UserInformations_userId_key" ON "UserInformations"("userId")`)
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UserInformations_email_key" ON "UserInformations"("email")`)

    // Notification enums and table
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'enum_NotificationType' AND n.nspname = 'eu_west_server_public') THEN
          CREATE TYPE "enum_NotificationType" AS ENUM ('EXAM_ASSIGNED', 'FEEDBACK_RECEIVED', 'ACCOUNT_CREATED', 'COHORT_ACCOUNT_OPENED', 'EXAM_UNLOCKED', 'EXAM_SANDBOX_ENABLED', 'EXAM_SANDBOX_DISABLED', 'FEEDBACK_REPLIED', 'STUDENT_EXAM_COMPLETED', 'NEW_FEATURE', 'KNOWN_BUG', 'ACCOUNT_EXPIRING');
        END IF;
      END $$
    `)

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'enum_NotificationChannel' AND n.nspname = 'eu_west_server_public') THEN
          CREATE TYPE "enum_NotificationChannel" AS ENUM ('in_app', 'email', 'sms');
        END IF;
      END $$
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Notifications" (
        "id" SERIAL NOT NULL,
        "userId" INTEGER NOT NULL,
        "type" "enum_NotificationType" NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "deepLink" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
      )
    `)

    await client.query('COMMIT')
    console.log('eu_west_server_public schema setup complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
