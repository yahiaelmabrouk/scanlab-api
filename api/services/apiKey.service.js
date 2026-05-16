const _ = require('lodash')
const { generateApiKey, hashApiKey } = require('../api_util/apiKey')
const prisma = require('../../db/prisma')
const apiUtil = require('../api_util/api_util')

const ApiKeyService = {
  async createApiKey(user, cohortId, name, expiresAt = null) {
    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to create API keys')
    }

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    })

    if (!cohort) {
      throw new Error('Cohort not found')
    }

    let apiKeyData
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      try {
        apiKeyData = await generateApiKey()

        const apiKey = await prisma.apiKey.create({
          data: {
            name,
            keyPrefix: apiKeyData.prefix,
            keyHash: apiKeyData.hash,
            cohortId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            Cohort: {
              select: { id: true, name: true },
            },
          },
        })

        return {
          ...apiKey,
          fullKey: apiKeyData.fullKey,
        }
      } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('keyPrefix')) {
          attempts++
          if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique API key after multiple attempts')
          }
          continue
        }
        throw error
      }
    }
  },

  async getApiKeys(user, cohortId) {
    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to view API keys')
    }

    return await prisma.apiKey.findMany({
      where: { cohortId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        Cohort: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async deleteApiKey(user, keyId) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { Cohort: true },
    })

    if (!apiKey) {
      throw new Error('API key not found')
    }

    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, apiKey.cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to delete API keys')
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    })

    return { success: true }
  },

  async deactivateApiKey(user, keyId) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { Cohort: true },
    })

    if (!apiKey) {
      throw new Error('API key not found')
    }

    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, apiKey.cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to deactivate API keys')
    }

    return await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        Cohort: {
          select: { id: true, name: true },
        },
      },
    })
  },

  async regenerateApiKey(user, keyId, newName = null) {
    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { Cohort: true },
    })

    if (!existingKey) {
      throw new Error('API key not found')
    }

    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, existingKey.cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to regenerate API keys')
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    })

    return await this.createApiKey(user, existingKey.cohortId, newName || existingKey.name, existingKey.expiresAt)
  },

  async activateApiKey(user, keyId) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { Cohort: true },
    })

    if (!apiKey) {
      throw new Error('API key not found')
    }

    if (!(await apiUtil.isAdmin(user)) && !(await apiUtil.isManagerOfCohort(user, apiKey.cohortId))) {
      throw new Error('Unauthorized: Must be admin or cohort manager to activate API keys')
    }

    return await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        Cohort: {
          select: { id: true, name: true },
        },
      },
    })
  },
}

module.exports = ApiKeyService
