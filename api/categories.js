const express = require('express')
const router = express.Router()
const { Category } = require('../db/models')

router.get('/categories', async function (req, res) {
  let categories = await Category.findAll({
    order: [['name', 'DESC']],
    attributes: ['id', 'name'],
  })

  res.json({ success: true, categories })
})

module.exports = router
