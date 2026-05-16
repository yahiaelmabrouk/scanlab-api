const express = require('express')
const router = express.Router()
const service = require('../services/stackQuestionResultComment.service')
const { fetchLoggedInUser } = require('../api_util/api_util')

router.post('/stackQuestionResultComment/viewComment', fetchLoggedInUser, async function (req, res) {
  const user = req.user
  const data = await service.viewComment(user.id, req.query.testRunUserId, req.body)

  res.json({ success: true, data })
})

router.post('/stackQuestionResultComment', fetchLoggedInUser, async function (req, res) {
  const user = req.user
  const data = await service.createComment(user.id, req.query.testRunUserId, req.body)
  res.json({ success: true, data })
})

router.put('/stackQuestionResultComment/:id', fetchLoggedInUser, async function (req, res) {
  const user = req.user
  const id = req.params.id
  const data = await service.updateComment(id, user.id, req.query.testRunUserId, req.body)
  res.json({ success: true, data })
})

module.exports = router
