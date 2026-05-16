const { Language, sequelize } = require('../../db/models')
const { v4: uuidv4 } = require('uuid')
const _ = require('lodash')
const { S3_BUCKET, getUploadUrl, s3Upload } = require('../api_util/aws')

const getAllLanguages = async () => {
  let where = {}

  let languages = await Language.findAll({
    where,
    order: [['id', 'ASC']],
  })

  return languages
}

const getAllLanguageOptions = async () => {
  let where = {}

  let languages = await Language.findAll({
    where,
    attributes: ['id', 'code', 'flag', 'name'],
    order: [['name', 'ASC']],
  })

  const serializedLanguages = await Promise.all(languages.map(async (language) => {
    if (language.flag && language.flag.startsWith('s3-flags')) {
      Object.assign(language, {
        flag: await getUploadUrl(language.flag),
      })
    }
    return language
  }))

  return serializedLanguages
}

const getLanguageByCode = async (code) => {
  let where = {}

  if (code) {
    where.code = code
  }

  let language = await Language.findOne({
    where,
  })

  if (language && language.flag && language.flag.startsWith('s3-flags')) {
    Object.assign(language, {
      flag: await getUploadUrl(language.flag),
    })
  }

  return language
}

const uploadFlagImage = async (flagSrc) => {
  if (_.startsWith(flagSrc, 'data:image')) {
    const buf = Buffer.from(flagSrc.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    //generate random number so that save the file to s3
    const envPath = process.env.NODE_ENV ?? 'development'
    const pathKey = `s3-flags/${envPath}/${uuidv4()}.jpg`
    await s3Upload(S3_BUCKET, pathKey, buf, 'image/jpeg')
    return pathKey
  }
  return flagSrc
}

const updateLanguage = async (id, data) => {
  const language = await Language.findOne({
    where: { id },
  })

  if (!language) {
    throw { status: 400, message: 'Language not found' }
  }

  let result = {}

  if (_.has(data, ['flagSrc'])) {
    data.flag = await uploadFlagImage(data.flagSrc)
    delete data.flagSrc
  }

  try {
    await sequelize.transaction(async (transaction) => {
      _.extend(language, {
        ...data,
      })

      await language.save({ transaction })
      result = language
      if (result.flag && result.flag.startsWith('s3-flags')) {
        Object.assign(result, {
          flag: await getUploadUrl(result.flag),
        })
      }
    })

    return result
  } catch (error) {
    throw { status: 500, message: error.message }
  }
}

const addLanguage = async (data) => {
  const existingLanguage = await getLanguageByCode(data.code)
  if (existingLanguage) {
    let language = await updateLanguage(existingLanguage.id, data)
    return language
  } else {
    let language = await Language.create(data)
    return language
  }
}

const LanguageService = {
  getAllLanguages,
  getAllLanguageOptions,
  addLanguage,
  updateLanguage,
  getLanguageByCode,
}

module.exports = LanguageService
