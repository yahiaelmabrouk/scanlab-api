const moment = require('moment/moment')

const registrationCodeUtil = {
  getRegistrationCodeExpirationDate: (daysTilExpired, activationDate) => {
    const expirationDateAfterRegistration = moment(activationDate).add(daysTilExpired, 'days').toDate()
    return expirationDateAfterRegistration
  },
  checkAccountValid: (daysTilExpired, activationDate) => {
    const expirationDateAfterRegistration = moment(activationDate).add(daysTilExpired, 'days').toDate()
    const today = moment()
    return expirationDateAfterRegistration < today
  },
}

module.exports = registrationCodeUtil
