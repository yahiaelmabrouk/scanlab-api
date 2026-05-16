// eslint-disable-next-line node/no-extraneous-require
require('dotenv').config()
const { isProduction } = require('../util/environment')

const config = {
  development: {
    // username: 'postgres',
    // password: '123456',
    // database: 'scanlab',
    // host: 'localhost',
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOSTNAME,
    dialect: 'postgres',
    logging: isProduction() ? false : true,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: {
    // This makes it use a connection URL from an env variable
    use_env_variable: 'DATABASE_URL_PRIMARY',
    // username: process.env.DATABASE_USERNAME,
    // password: process.env.DATABASE_PASSWORD,
    // database: process.env.DATABASE_NAME,
    // host: process.env.DATABASE_HOSTNAME,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '5'),
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  },
}

if (process.env.USE_REMOTE_DB) {
  config.development.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  }
}

module.exports = config
