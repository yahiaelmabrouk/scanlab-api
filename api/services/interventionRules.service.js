const crypto = require('crypto')
const prisma = require('../../db/prisma')

const VALID_DOMAINS = ['clinical', 'didactic']
const VALID_LEVELS = ['overall', 'level1', 'level2', 'level3', 'level4', 'level5']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INTERVENTIONS = 100
const MAX_INTERVENTION_TEXT_LENGTH = 1000

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function serialize(row) {
  const base = {
    id: row.id,
    domain: row.domain,
    skillId: row.skillId,
    categoryId: row.categoryId,
    level: row.level,
    from: row.fromScore,
    to: row.toScore,
    interventions: Array.isArray(row.interventions) ? row.interventions : [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
  return base
}

function bucket(rows) {
  const out = { clinical: {}, didactic: {} }
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
    }
  }
  return out
}

function coerceScore(value, label) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new HttpError(400, `\`${label}\` must be an integer`)
    return value
  }
  if (typeof value === 'string' && value.trim() !== '' && /^-?\d+$/.test(value.trim())) {
    return parseInt(value, 10)
  }
  throw new HttpError(400, `\`${label}\` must be an integer`)
}

function validateScoreRange(from, to) {
  if (from < 0 || from > 100 || to < 0 || to > 100) {
    throw new HttpError(400, '`from` and `to` must be between 0 and 100')
  }
  if (from > to) {
    throw new HttpError(400, '`from` must be <= `to`')
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
  const { domain, skillId, categoryId, level, from, to, interventions } = body || {}

  if (!VALID_DOMAINS.includes(domain)) {
    throw new HttpError(400, '`domain` must be "clinical" or "didactic"')
  }

  if (domain === 'clinical') {
    if (typeof skillId !== 'string' || skillId.trim() === '') {
      throw new HttpError(400, '`skillId` is required for clinical rules')
    }
    if (categoryId !== undefined || level !== undefined) {
      throw new HttpError(400, '`categoryId` and `level` are not allowed for clinical rules')
    }
  } else {
    if (!Number.isInteger(categoryId)) {
      throw new HttpError(400, '`categoryId` (integer) is required for didactic rules')
    }
    if (!VALID_LEVELS.includes(level)) {
      throw new HttpError(400, `\`level\` must be one of: ${VALID_LEVELS.join(', ')}`)
    }
    if (skillId !== undefined) {
      throw new HttpError(400, '`skillId` is not allowed for didactic rules')
    }
  }

  const fromInt = coerceScore(from, 'from')
  const toInt = coerceScore(to, 'to')
  validateScoreRange(fromInt, toInt)
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
    fromScore: fromInt,
    toScore: toInt,
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
  for (const immutable of ['domain', 'skillId', 'categoryId']) {
    if (immutable in body) {
      throw new HttpError(400, `\`${immutable}\` is immutable and cannot be updated`)
    }
  }

  const { from, to, level, interventions } = body
  const fromInt = coerceScore(from, 'from')
  const toInt = coerceScore(to, 'to')
  validateScoreRange(fromInt, toInt)

  const update = { fromScore: fromInt, toScore: toInt }

  if (existing.domain === 'didactic') {
    if (!VALID_LEVELS.includes(level)) {
      throw new HttpError(400, `\`level\` must be one of: ${VALID_LEVELS.join(', ')}`)
    }
    update.level = level
  }
  // For clinical rules, `level` in the payload is ignored (per spec).

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
