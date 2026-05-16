const { Op } = require('sequelize')

function escapeValue(val) {
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  if (val === null) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Numeric value must be finite')
    return String(val)
  }
  throw new Error(`Unsupported value type: ${typeof val}`)
}

function escapeIdentifier(name) {
  if (typeof name !== 'string') throw new Error('Identifier must be a string')
  return name.replace(/"/g, '""')
}

function formatSequelizeKey(key) {
  // Only process if key starts and ends with $
  if (typeof key === 'string' && key.startsWith('$') && key.endsWith('$')) {
    const inner = key.slice(1, -1) // Remove leading and trailing $
    // Find the last dot
    const lastDot = inner.lastIndexOf('.')
    if (lastDot !== -1) {
      const left = inner.slice(0, lastDot) // e.g. questionSetResult->questionSet->bodyPart
      const right = inner.slice(lastDot + 1) // e.g. name
      return `"${escapeIdentifier(left)}"."${escapeIdentifier(right)}"`
    } else {
      // No dot, treat the whole as one identifier
      return `"${escapeIdentifier(inner)}"`
    }
  }
  // Not a special key, just quote it
  return `"${escapeIdentifier(key)}"`
}

function parseCondition(key, value, tableName = '') {
  if (value === undefined) {
    return `true` // Treat undefined or null as true
  }
  const sqlKey = formatSequelizeKey(key)
  const colRef = tableName ? `"${escapeIdentifier(tableName)}"."${escapeIdentifier(key)}"` : sqlKey
  if (typeof value !== 'object' || value === null) {
    return `${colRef} = ${escapeValue(value)}`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `false`
    }
    return `${colRef} IN (${value.map(escapeValue).join(', ')})`
  }
  const clauses = []
  for (const op of Object.getOwnPropertySymbols(value)) {
    const opVal = value[op]
    switch (op) {
      case Op.eq:
        clauses.push(`${colRef} = ${escapeValue(opVal)}`)
        break
      case Op.ne:
        clauses.push(`${colRef} != ${escapeValue(opVal)}`)
        break
      case Op.gt:
        clauses.push(`${colRef} > ${escapeValue(opVal)}`)
        break
      case Op.gte:
        clauses.push(`${colRef} >= ${escapeValue(opVal)}`)
        break
      case Op.lt:
        clauses.push(`${colRef} < ${escapeValue(opVal)}`)
        break
      case Op.lte:
        clauses.push(`${colRef} <= ${escapeValue(opVal)}`)
        break
      case Op.or:
        clauses.push(
          opVal.length > 1
            ? `(${opVal
                .map((el) => {
                  if (el == null) {
                    return `${colRef} IS NULL`
                  } else {
                    return `${colRef} = ${escapeValue(el)}`
                  }
                })
                .join(' OR ')})`
            : opVal
                .map((el) => {
                  if (el == null) {
                    return `${colRef} IS NULL`
                  } else {
                    return `${colRef} = ${escapeValue(el)}`
                  }
                })
                .join(' OR ')
        )
        break
      case Op.in:
        if (opVal.length === 0) {
          clauses.push(`false`)
          break
        }
        clauses.push(`${colRef} IN (${opVal.map(escapeValue).join(', ')})`)
        break
      case Op.notIn:
        clauses.push(
          `${colRef} NOT IN (${opVal.map(escapeValue).join(', ')})`
        )
        break
      case Op.like:
        clauses.push(`${colRef} LIKE ${escapeValue(opVal)}`)
        break
      case Op.iLike:
        clauses.push(`${colRef} ILIKE ${escapeValue(opVal)}`)
        break
      case Op.notLike:
        clauses.push(`${colRef} NOT LIKE ${escapeValue(opVal)}`)
        break
      case Op.is:
        clauses.push(`${colRef} IS ${escapeValue(opVal)}`)
        break
      case Op.not:
        clauses.push(`${colRef} IS NOT ${escapeValue(opVal)}`)
        break
      case Op.between:
        clauses.push(
          `${colRef} BETWEEN ${escapeValue(opVal[0])} AND ${escapeValue(opVal[1])}`
        )
        break
      case Op.notBetween:
        clauses.push(
          `${colRef} NOT BETWEEN ${escapeValue(opVal[0])} AND ${escapeValue(opVal[1])}`
        )
        break
      default:
        break
    }
  }
  return clauses.length > 1 ? `(${clauses.join(' AND ')})` : clauses.join(' AND ')
}

function whereObjectToSql(where, isParent = true, tableName = '') {
  if (!where || typeof where !== 'object') return ''
  const clauses = []

  // Handle string keys
  for (const key of Object.keys(where)) {
    clauses.push(parseCondition(key, where[key], tableName))
  }

  // Handle symbol keys (Op.and, Op.or, etc.)
  for (const sym of Object.getOwnPropertySymbols(where)) {
    const val = where[sym]
    if (sym === Op.and) {
      const andClauses = val.map((el) => whereObjectToSql(el, false, tableName)).filter(Boolean)
      if (andClauses.length) clauses.push(andClauses.join(' AND '))
    } else if (sym === Op.or) {
      const orClauses = val.map((el) => whereObjectToSql(el, false, tableName)).filter(Boolean)
      if (orClauses.length) clauses.push(`(${orClauses.join(' OR ')})`)
    }
  }
  if (!clauses.length) return 'true'
  return clauses.length > 1 && !isParent ? `(${clauses.join(' AND ')})` : clauses.join(' AND ')
}

/**
 * Run a raw SQL query with a PostgreSQL statement_timeout guard.
 * Uses SET LOCAL inside a lightweight transaction so the timeout only
 * applies to this specific query and is automatically rolled-back on cancel.
 *
 * @param {import('sequelize').Sequelize} sequelize  Sequelize instance
 * @param {string} sql        Raw SQL to execute
 * @param {object} [options]  Sequelize query options (type, raw, etc.)
 * @param {number} [timeoutMs=30000]  Timeout in milliseconds (default 30 s)
 * @returns {Promise<any>}    Query result
 */
async function queryWithTimeout(sequelize, sql, options = {}, timeoutMs = 30000) {
  const timeout = Math.round(timeoutMs)
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error('Invalid timeout value')
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(`SET LOCAL statement_timeout = '${timeout}'`, { transaction })
    return sequelize.query(sql, { ...options, transaction })
  })
}

module.exports = { whereObjectToSql, queryWithTimeout }
