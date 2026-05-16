const express = require('express')
const router = express.Router()
const R = require('r-integration')

router.get('/analysis', function (req, res) {
  let result = R.executeRScript('r/skillAssessmentScript2.R')

  res.json(result)
})

router.get('/analysis_cohort', async function (req, res) {
  if (!req.query.cohortId) {
    res.status(500).json({ success: false })
  }

  let result = R.callMethod('r/skillAssessmentCohortScriptPlotly.R', 'run', { cohort_id: parseInt(req.query.cohortId) })

  res.json({ success: result?.[0] === 200 })
})

router.get('/analysis_person', async function (req, res) {
  if (!req.query.personId) {
    res.status(500).json({ success: false })
  }

  let result = R.callMethod('r/skillAssessmentPersonScriptPlotly.R', 'run', {
    person_id: 'p_' + req.query.personId,
  })

  res.json({ success: result?.[0] === 200 })
})

module.exports = router
