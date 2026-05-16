// eslint-disable-next-line node/no-extraneous-require
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const url = new URL(process.env.DATABASE_URL_PRIMARY)
url.searchParams.set('connection_limit', process.env.PRISMA_POOL_MAX || '5')
url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '30')

const prisma = new PrismaClient({
  datasources: { db: { url: url.toString() } },
})

module.exports = prisma
