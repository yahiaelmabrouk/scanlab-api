// eslint-disable-next-line node/no-extraneous-require
require('dotenv').config()
const { Pool } = require('pg')

// Configuration for PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL_PRIMARY })

const MAX_RETRIES = 5
const LOCK_TIMEOUT_MS = 5000
const RETRY_DELAY_MS = 10000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Rebuild the eu_west_server_public foreign schema and configure sequences.
// Uses a short lock_timeout to avoid blocking live queries that read from
// the foreign tables. Retries up to MAX_RETRIES times with a delay between
// attempts to wait for a gap in traffic.
async function executeQuery() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = await pool.connect()
    try {
      console.log(`[migration-script] Attempt ${attempt}/${MAX_RETRIES} — acquiring schema lock (timeout ${LOCK_TIMEOUT_MS}ms)`)

      // Set a short lock timeout so DROP SCHEMA fails fast instead of
      // blocking all queries that read from the foreign tables.
      await client.query(`SET lock_timeout = '${LOCK_TIMEOUT_MS}ms';`)

      // Drop and recreate schema, import foreign tables
      await client.query('DROP SCHEMA IF EXISTS eu_west_server_public CASCADE;')
      await client.query('CREATE SCHEMA eu_west_server_public;')
      await client.query('IMPORT FOREIGN SCHEMA public FROM SERVER eu_west_server INTO eu_west_server_public;')

      await client.query('SET search_path TO public, eu_west_server_public;')

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_testrun_id_seq OWNED BY eu_west_server_public."TestRuns".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_testrun_id_seq', (SELECT MAX(id) FROM eu_west_server_public."TestRuns"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."TestRuns" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_testrun_id_seq');`
      )

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_multiple_choice_question_result_id_seq OWNED BY eu_west_server_public."MultipleChoiceQuestionResults".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_multiple_choice_question_result_id_seq', (SELECT MAX(id) FROM eu_west_server_public."MultipleChoiceQuestionResults"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."MultipleChoiceQuestionResults" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_multiple_choice_question_result_id_seq');`
      )

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_question_set_result_id_seq OWNED BY eu_west_server_public."QuestionSetResults".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_question_set_result_id_seq', (SELECT MAX(id) FROM eu_west_server_public."QuestionSetResults"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."QuestionSetResults" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_question_set_result_id_seq');`
      )

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_stack_question_result_id_seq OWNED BY eu_west_server_public."StackQuestionResults".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_stack_question_result_id_seq', (SELECT MAX(id) FROM eu_west_server_public."StackQuestionResults"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."StackQuestionResults" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_stack_question_result_id_seq');`
      )

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_stack_question_result_comment_id_seq OWNED BY eu_west_server_public."StackQuestionResultComments".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_stack_question_result_comment_id_seq', (SELECT MAX(id) FROM eu_west_server_public."StackQuestionResultComments"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."StackQuestionResultComments" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_stack_question_result_comment_id_seq');`
      )

      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS eu_west_server_public.eu_west_server_user_information_id_seq OWNED BY eu_west_server_public."UserInformations".id;`
      )
      await client.query(
        `SELECT setval('eu_west_server_user_information_id_seq', (SELECT MAX(id) FROM eu_west_server_public."UserInformations"));`
      )
      await client.query(
        `ALTER TABLE eu_west_server_public."UserInformations" ALTER COLUMN id SET DEFAULT nextval('eu_west_server_user_information_id_seq');`
      )

      console.log('[migration-script] Remote database updated, foreign tables synced.')
      client.release()
      await pool.end()
      return
    } catch (err) {
      client.release()

      const isLockTimeout = err.code === '55P03' // lock_not_available
      if (isLockTimeout && attempt < MAX_RETRIES) {
        console.warn(`[migration-script] Lock timeout on attempt ${attempt}/${MAX_RETRIES}, retrying in ${RETRY_DELAY_MS / 1000}s...`)
        await sleep(RETRY_DELAY_MS)
      } else {
        console.error(`[migration-script] Failed on attempt ${attempt}/${MAX_RETRIES}:`, err.stack)
        await pool.end()
        process.exit(1)
      }
    }
  }
}

// Run the query
executeQuery()
