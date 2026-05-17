const crypto = require('crypto')
const prisma = require('../../db/prisma')

const VALID_DOMAINS = ['clinical', 'didactic', 'consistency']
const VALID_LEVELS = ['overall', 'level1', 'level2', 'level3', 'level4', 'level5']
const VALID_METRICS = ['angulation', 'wastedSlices', 'wastedCoverage']
const VALID_AGGREGATIONS = ['absoluteTotal', 'total', 'absoluteMean']
const VALID_SCOPES = ['perExam', 'perQuestion']
const METRICS_REQUIRING_AGGREGATION = ['wastedSlices', 'wastedCoverage']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INTERVENTIONS = 100
const MAX_INTERVENTION_TEXT_LENGTH = 1000

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function toNumber(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value)
}

function serialize(row) {
  return {
    id: row.id,
    domain: row.domain,
    skillId: row.skillId,
    categoryId: row.categoryId,
    level: row.level,
    metric: row.metric,
    aggregation: row.aggregation,
    scope: row.scope,
    from: toNumber(row.fromValue),
    to: toNumber(row.toValue),
    interventions: Array.isArray(row.interventions) ? row.interventions : [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

function bucket(rows) {
  const out = { clinical: {}, didactic: {}, consistency: {} }
  for (const row of rows) {
    const rule = serialize(row)
    if (rule.domain === 'clinical') {
      const key = rule.skillId
      if (!out.clinical[key]) out.clinical[key] = []
      out.clinical[key].push(rule)
    } else if (rule.domain === 'didactic') {
      const key = String(rule.categoryId)
      if (!out.didactic[key]) out.didactic[key] = {}
      if (!out.didactic[key][rule.level]) out.didactic[key][rule.level] = []
      out.didactic[key][rule.level].push(rule)
    } else if (rule.domain === 'consistency') {
      const key = rule.metric
      if (!out.consistency[key]) out.consistency[key] = []
      out.consistency[key].push(rule)
    }
  }
  return out
}

function coerceScore(value, label) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new HttpError(400, `\`${label}\` must be a number`)
    return value
  }
  if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return parseFloat(value)
  }
  throw new HttpError(400, `\`${label}\` must be a number`)
}

function validateScoreRange({ domain, metric, aggregation }, from, to) {
  if (from > to) {
    throw new HttpError(400, '`from` must be <= `to`')
  }
  if (domain === 'clinical' || domain === 'didactic') {
    if (from < 0 || from > 100 || to < 0 || to > 100) {
      throw new HttpError(400, '`from` and `to` must be between 0 and 100')
    }
    return
  }
  // consistency
  const negativesAllowed = METRICS_REQUIRING_AGGREGATION.includes(metric) && aggregation === 'total'
  if (!negativesAllowed && from < 0) {
    throw new HttpError(400, '`from` must be >= 0 for this metric/aggregation')
  }
}

function validateInterventionsArray(interventions, { allowIds }) {
  if (!Array.isArray(interventions) || interventions.length < 1) {
    throw new HttpError(400, '`interventions` must be a non-empty array')
  }
  if (interventions.length > MAX_INTERVENTIONS) {
    throw new HttpError(400, `\`interventions\` cannot exceed ${MAX_INTERVENTIONS} items`)
  }
  for (const item of interventions) {
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'Each intervention must be an object')
    }
    if (typeof item.text !== 'string' || item.text.trim() === '') {
      throw new HttpError(400, 'Each intervention `text` must be a non-empty string')
    }
    if (item.text.trim().length > MAX_INTERVENTION_TEXT_LENGTH) {
      throw new HttpError(400, `Each intervention \`text\` cannot exceed ${MAX_INTERVENTION_TEXT_LENGTH} characters`)
    }
    if (!allowIds && item.id !== undefined) {
      throw new HttpError(400, 'Intervention `id` is not accepted on create')
    }
  }
}

function buildCreatePayload(body) {
  const { domain, skillId, categoryId, level, metric, aggregation, scope, from, to, interventions } = body || {}

  if (!VALID_DOMAINS.includes(domain)) {
    throw new HttpError(400, '`domain` must be "clinical", "didactic", or "consistency"')
  }

  if (domain === 'clinical') {
    if (typeof skillId !== 'string' || skillId.trim() === '') {
      throw new HttpError(400, '`skillId` is required for clinical rules')
    }
    if (categoryId !== undefined || level !== undefined) {
      throw new HttpError(400, '`categoryId` and `level` are not allowed for clinical rules')
    }
    if (metric !== undefined || aggregation !== undefined) {
      throw new HttpError(400, '`metric` and `aggregation` are not allowed for clinical rules')
    }
    if (scope !== undefined) {
      throw new HttpError(400, '`scope` is not allowed for clinical rules')
    }
  } else if (domain === 'didactic') {
    if (!Number.isInteger(categoryId)) {
      throw new HttpError(400, '`categoryId` (integer) is required for didactic rules')
    }
    if (!VALID_LEVELS.includes(level)) {
      throw new HttpError(400, `\`level\` must be one of: ${VALID_LEVELS.join(', ')}`)
    }
    if (skillId !== undefined) {
      throw new HttpError(400, '`skillId` is not allowed for didactic rules')
    }
    if (metric !== undefined || aggregation !== undefined) {
      throw new HttpError(400, '`metric` and `aggregation` are not allowed for didactic rules')
    }
    if (scope !== undefined) {
      throw new HttpError(400, '`scope` is not allowed for didactic rules')
    }
  } else {
    // consistency
    if (!VALID_METRICS.includes(metric)) {
      throw new HttpError(400, `\`metric\` must be one of: ${VALID_METRICS.join(', ')}`)
    }
    if (!VALID_SCOPES.includes(scope)) {
      throw new HttpError(400, `\`scope\` must be one of: ${VALID_SCOPES.join(', ')}`)
    }
    if (skillId !== undefined || categoryId !== undefined || level !== undefined) {
      throw new HttpError(400, '`skillId`, `categoryId`, and `level` are not allowed for consistency rules')
    }
    if (METRICS_REQUIRING_AGGREGATION.includes(metric)) {
      if (!VALID_AGGREGATIONS.includes(aggregation)) {
        throw new HttpError(400, `\`aggregation\` must be one of: ${VALID_AGGREGATIONS.join(', ')} for ${metric}`)
      }
    } else if (aggregation !== undefined) {
      throw new HttpError(400, '`aggregation` is not allowed for `angulation`')
    }
  }

  const fromNum = coerceScore(from, 'from')
  const toNum = coerceScore(to, 'to')
  validateScoreRange({ domain, metric, aggregation }, fromNum, toNum)
  validateInterventionsArray(interventions, { allowIds: false })

  const stampedInterventions = interventions.map((it) => ({
    id: crypto.randomUUID(),
    text: it.text.trim(),
  }))

  return {
    domain,
    skillId: domain === 'clinical' ? skillId : null,
    categoryId: domain === 'didactic' ? categoryId : null,
    level: domain === 'didactic' ? level : null,
    metric: domain === 'consistency' ? metric : null,
    aggregation: domain === 'consistency' && METRICS_REQUIRING_AGGREGATION.includes(metric) ? aggregation : null,
    scope: domain === 'consistency' ? scope : null,
    fromValue: fromNum,
    toValue: toNum,
    interventions: stampedInterventions,
  }
}

function reconcileInterventions(existing, incoming) {
  validateInterventionsArray(incoming, { allowIds: true })
  const existingIds = new Set((existing || []).map((it) => it.id))
  const result = []
  for (const item of incoming) {
    if (item.id !== undefined) {
      if (typeof item.id !== 'string' || !existingIds.has(item.id)) {
        throw new HttpError(400, `Unknown intervention id: ${item.id}`)
      }
      result.push({ id: item.id, text: item.text.trim() })
    } else {
      result.push({ id: crypto.randomUUID(), text: item.text.trim() })
    }
  }
  return result
}

function buildUpdatePayload(existing, body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body required')
  }
  for (const immutable of ['domain', 'skillId', 'categoryId', 'metric', 'scope']) {
    if (immutable in body) {
      throw new HttpError(400, `\`${immutable}\` is immutable and cannot be updated`)
    }
  }

  const { from, to, level, aggregation, interventions } = body
  const fromNum = coerceScore(from, 'from')
  const toNum = coerceScore(to, 'to')

  const update = { fromValue: fromNum, toValue: toNum }

  if (existing.domain === 'didactic') {
    if (!VALID_LEVELS.includes(level)) {
      throw new HttpError(400, `\`level\` must be one of: ${VALID_LEVELS.join(', ')}`)
    }
    update.level = level
  }
  // For clinical and consistency rules, `level` in the payload is ignored.

  let effectiveAggregation = existing.aggregation
  if (existing.domain === 'consistency') {
    if (METRICS_REQUIRING_AGGREGATION.includes(existing.metric)) {
      if (!VALID_AGGREGATIONS.includes(aggregation)) {
        throw new HttpError(
          400,
          `\`aggregation\` must be one of: ${VALID_AGGREGATIONS.join(', ')} for ${existing.metric}`
        )
      }
      update.aggregation = aggregation
      effectiveAggregation = aggregation
    } else if ('aggregation' in body) {
      throw new HttpError(400, '`aggregation` is not allowed for `angulation`')
    }
  }

  validateScoreRange(
    { domain: existing.domain, metric: existing.metric, aggregation: effectiveAggregation },
    fromNum,
    toNum
  )

  update.interventions = reconcileInterventions(existing.interventions, interventions)
  return update
}

const InterventionRulesService = {
  HttpError,

  async listAllBucketed() {
    const rows = await prisma.interventionRule.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return bucket(rows)
  },

  async create({ body, userId }) {
    const data = buildCreatePayload(body)
    const row = await prisma.interventionRule.create({
      data: { ...data, createdBy: userId },
    })
    return serialize(row)
  },

  async update({ id, body }) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new HttpError(404, 'Rule not found')
    }
    const existing = await prisma.interventionRule.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Rule not found')
    const update = buildUpdatePayload(existing, body)
    const row = await prisma.interventionRule.update({ where: { id }, data: update })
    return serialize(row)
  },

  async remove(id) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new HttpError(404, 'Rule not found')
    }
    try {
      await prisma.interventionRule.delete({ where: { id } })
    } catch (err) {
      if (err && err.code === 'P2025') throw new HttpError(404, 'Rule not found')
      throw err
    }
  },
}

module.exports = InterventionRulesService
