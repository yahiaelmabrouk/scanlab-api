require('dotenv-defaults/config')
const { notifyUser } = require('./../api/services/notification.service')

const USER_ID = parseInt(process.argv[2], 10)

if (!USER_ID) {
  console.error('Usage: node scripts/test-notify.js <userId>')
  process.exit(1)
}

async function run() {
  console.log(`\nFiring all notification events for user ${USER_ID}...\n`)

  await notifyUser(USER_ID, 'EXAM_ASSIGNED', {
    title: 'New exam assigned: Brain MRI Basics',
    message: 'A new exam has been assigned to you: Brain MRI Basics',
    deepLink: 'https://app.scanlabmr.com/exams/1',
    emailSubject: 'New exam assigned to you',
    emailHtml: '<p>A new exam <strong>Brain MRI Basics</strong> has been assigned to you.</p>',
  })
  console.log('[1/2] EXAM_ASSIGNED sent')

  await notifyUser(USER_ID, 'FEEDBACK_RECEIVED', {
    title: 'Feedback received',
    message: 'Your instructor has left feedback on your scan submission.',
    deepLink: 'https://app.scanlabmr.com/test-runs/1',
    emailSubject: 'Feedback received on your scan submission',
    emailHtml: '<p>Your instructor has left feedback on your scan submission.</p>',
  })
  console.log('[2/2] FEEDBACK_RECEIVED sent')

  console.log('\nDone — check GET /v1/notifications to see all 4 events.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
