const { validate, Joi } = require('express-validation')

const v = (validationObject) => validate(validationObject, { keyByField: true })

module.exports = {
  v,
  Joi,
}
