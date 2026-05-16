const _ = require('lodash')
const express = require('express')
const { fetchLoggedInUser, requireAdmin, errorHandler, serializeUser } = require('./api_util/api_util')
const { Role, User, UserInformationEuWest, UserInformation } = require('../db/models')

const router = express.Router()

function roleFindParams(where) {
  return {
    where,
    attributes: ['id', 'name', 'createdAt'],
    include: [
      {
        model: User,
        as: 'user',
        include: [
          {
            model: UserInformationEuWest,
            as: 'userInfoEuWest',
          },
          {
            model: UserInformation,
            as: 'userInfo',
          },
        ],
      },
    ],
    order: [['id', 'ASC']],
  }
}

function serializeRole(role) {
  return {
    ..._.pick(role, ['id', 'name', 'createdAt']),
    user: serializeUser(role.user),
  }
}

router.get('/roles', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    let where = {}

    if (req.query.name) {
      where.name = req.query.name
    }

    let roles = await Role.findAll(roleFindParams(where))
    roles = roles.map(serializeRole)

    res.json({ success: true, roles })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.post('/roles', fetchLoggedInUser, requireAdmin, async function (req, res) {
  let roleName = req.body.name

  try {
    let userInformation = await UserInformation.findOne({ where: { email: req.body.userEmail } })
    if (!userInformation) {
      userInformation = await UserInformationEuWest.findOne({ where: { email: req.body.userEmail } })
    }

    if (!userInformation) {
      return res.json({ success: false, error_description: `User with email "${req.body.userEmail}" not found` })
    }

    let existingRole = await Role.findOne({ where: { userId: userInformation.userId, name: roleName } })
    if (existingRole) {
      return res.json({
        success: false,
        error_description: `User with email "${req.body.userEmail}" already has role "${roleName}"`,
      })
    }

    let role = await Role.create({ name: req.body.name, userId: userInformation.userId })
    role = serializeRole(role)

    res.json({ success: true, role })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.delete('/roles/:id', fetchLoggedInUser, requireAdmin, async function (req, res) {
  let roleId = req.params.id

  try {
    if (!roleId || !roleId.length) {
      return res.json({ success: false, error_description: 'Role id is required' })
    }

    await Role.destroy({
      where: { id: roleId },
    })
    res.json({ success: true })
  } catch (err) {
    errorHandler(res, err)
  }
})

module.exports = router
