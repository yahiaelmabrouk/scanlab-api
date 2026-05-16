const winston = require('winston')
const { combine, timestamp, printf } = winston.format
const { isProduction } = require('./environment')

const myFormat = printf(({ timestamp, level, message, json }) => {
  return `${timestamp} [${level}] ${message} ${!json ? '' : `: ${JSON.stringify(json)}`}`
})

const logger = winston.createLogger({
  level: isProduction() ? 'info' : 'debug',
  format: combine(timestamp(), myFormat),
  // format: winston.format.simple(),
  // defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' })
    new winston.transports.Console(),
  ],
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(new winston.transports.Console({
//     format: winston.format.simple()
//   }));
// }

// logger.info('Logger ready', {
//   json: {wow:true}
// });

module.exports = logger
