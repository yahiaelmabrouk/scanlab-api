const apiUtil = require('../api_util/api_util')
const { checkAccountValid } = require('../api_util/registrationCode')

const { User, RegistrationCode, Role, UserInformationEuWest, UserInformation } = require('../../db/models')

const UserSvc = {
  findUserById: async function (userId, response) {
    try {
      const user = await User.findOne({
        where: { id: userId },
        include: [
          {
            model: RegistrationCode,
            as: 'registrationCode',
            attributes: ['numOfDaysActive', 'activationDate', 'status'],
          },
          {
            model: Role,
            as: 'roles',
            attributes: ['name'],
          },
          {
            model: UserInformationEuWest,
            as: 'userInfoEuWest',
          },
          {
            model: UserInformation,
            as: 'userInfo',
          },
        ],
      })
      if (!user) {
        return response.status(401).send('User not found')
      }
      const userInfo = apiUtil.getUserInfomationFromUserModel(user)
      const { numOfDaysActive, activationDate, status } = userInfo.registrationCode || {
        numOfDaysActive: 365,
        activationDate: new Date(),
      }

      const registrationExpired = await checkAccountValid(numOfDaysActive, activationDate)

      const serializedUser = apiUtil.serializeUser(user)

      serializedUser.isAdmin = apiUtil.isAdmin(user)
      serializedUser.isManager = await apiUtil.isManager(user)
      serializedUser.registrationExpired = registrationExpired
      serializedUser.status = status
      serializedUser.roles = user.roles.map((role) => role.name)
      serializedUser.numOfDaysActive = numOfDaysActive
      serializedUser.activationDate = activationDate

      delete serializedUser.registrationCode

      response.json(serializedUser)
    } catch (e) {
      apiUtil.errorHandler(response, e, 'User not found')
    }
  },
}

module.exports = UserSvc
