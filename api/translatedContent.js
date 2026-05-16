const _ = require('lodash')
const express = require('express')
const moment = require('moment/moment')
const { Translate } = require('@google-cloud/translate').v2
const { fetchLoggedInUser, errorHandler, requireAdminOrTranslator } = require('./api_util/api_util')
const prisma = require('../db/prisma')

// TODO This is for the german questions that Matthew created for the demo in Germany.
// We need a proper way to override these translations
const SKIP_TRANSLATIONS = [831, 833, 836, 838, 845, 869, 837, 839, 841, 842, 843, 846, 848, 870, 871]

const translateClient = new Translate({
  key: process.env.GCP_KEY,
  projectId: process.env.GCP_PROJECT_ID,
})

async function translate(lang, text) {
  if (!text || _.trim(text).length === 0) {
    return null
  }

  const [translation] = await translateClient.translate(text, lang)

  return translation
}

async function createBodyPartContent(id, lang) {
  let bodyPart = await prisma.bodyPart.findUnique({ where: { id: Number(id) } })

  let content = {}

  content.name = await translate(lang, bodyPart.name)

  return content
}

async function createRegionContent(id, lang) {
  let region = await prisma.region.findUnique({ where: { id: Number(id) } })
  let content = {}

  content.name = await translate(lang, region.name)

  return content
}

async function createMultipleChoiceQuestionContent(id, lang) {
  let question = await prisma.multipleChoiceQuestion.findUnique({ where: { id: Number(id) } })
  let content = {}

  if (SKIP_TRANSLATIONS.includes(question.id)) {
    return question
  }

  const SCREENINGFORM_PROPS_TO_TRANSLATE = [
    'areaToScan',
    'reasonForMRI',
    'surgeriesSinceBirth',
    'locationOfMetalInBody',
    'locationOfJointReplacement',
    'locationOfBoneOrJointPins',
    'locationOfMetalRodsPlatesScrewsNails',
    'locationOfProsthesisImplant',
    'otherKnownAllergies',
    'medicationToPrepareDetails',
  ]

  const screeningFormEntries = SCREENINGFORM_PROPS_TO_TRANSLATE
    .map(key => ({ key, original: _.get(question.screeningForm, key) }))
    .filter(({ original }) => !!original)

  const [
    questionText,
    answerExplanation,
    translatedChoices,
    translatedScreeningFormValues,
  ] = await Promise.all([
    translate(lang, question.questionText),
    translate(lang, question.answerExplanation),
    Promise.all(question.choices.map(choice => translate(lang, choice.text))),
    Promise.all(screeningFormEntries.map(({ original }) => translate(lang, original))),
  ])

  content.questionText = questionText
  content.answerExplanation = answerExplanation
  content.choices = question.choices.map((choice, i) => ({ id: choice.id, text: translatedChoices[i] }))
  content.screeningForm = {}

  // add all/only the props of screeningForm that are user entered free-form text (so no static values that can just be translated statically, like 'male'/'female' or 'Yes'/'No' from a dropdown)
  screeningFormEntries.forEach(({ key }, i) => {
    content.screeningForm[key] = translatedScreeningFormValues[i]
  })

  return content
}

async function createStackQuestionContent(id, lang) {
  let question = await prisma.stackQuestion.findUnique({ where: { id: Number(id) } })
  let content = {}

  const [questionText, translatedAnswers] = await Promise.all([
    translate(lang, question.questionText),
    Promise.all(
      question.answers.map(async answer => {
        const [name, criteria, citation] = await Promise.all([
          translate(lang, answer.name),
          translate(lang, answer.criteria),
          translate(lang, answer.citation),
        ])
        return { id: answer.id, name, criteria, citation }
      })
    ),
  ])

  content.questionText = questionText
  content.answers = translatedAnswers

  return content
}

function createTranslatedContent(key) {
  let [type, id, lang] = key.split('|')

  switch (type) {
    case 'bodyPart':
      return createBodyPartContent(id, lang)

    case 'region':
      return createRegionContent(id, lang)

    case 'multipleChoiceQuestion':
      return createMultipleChoiceQuestionContent(id, lang)

    case 'stackQuestion':
      return createStackQuestionContent(id, lang)

    default:
      throw `Unknown content type to translate: ${type}`
  }
}

async function upsertRecord(record) {
  let content = await createTranslatedContent(record.key)

  if (record.id) {
    record = await prisma.translatedContent.update({
      data: {
        key: record.key,
        content: content,
      },
      where: {
        id: Number(record.id),
      },
    })
  } else {
    record = await prisma.translatedContent.create({
      data: {
        key: record.key,
        content: content,
      },
    })
  }

  return record
}

const router = express.Router()

router.get('/translatedContent/:key', fetchLoggedInUser, async function (req, res) {
  try {
    let oneDayAgo = moment().subtract(1, 'd')
    let key = req.params.key
    let record = await prisma.translatedContent.findUnique({ where: { key } })

    // if we don't have a record, build a new one
    if (record === null) {
      record = { key }
    }

    // We'll update the translations if we the record doesn't have any content, or its
    // older than a day (and not locked from manual editing).
    if (!record.content || (!record.locked && moment(record.updatedAt).isBefore(oneDayAgo))) {
      record = await upsertRecord(record)
    }

    record = _.pick(record, ['key', 'content'])
    res.json({ success: true, record })
  } catch (err) {
    errorHandler(res, err)
  }
})

router.patch('/translatedContent/:key', fetchLoggedInUser, requireAdminOrTranslator, async function (req, res) {
  try {
    let key = req.params.key
    let record = await prisma.translatedContent.findUnique({ where: { key } })

    if (record === null) {
      record = { key }
      await upsertRecord(record)
    }

    // TODO: this should compare the schemas more extensively, but just checking the top-level keys for now
    // should be okay
    if (!_.isEqual(Object.keys(record.content).sort(), Object.keys(req.body.content).sort())) {
      return res.status(400).json({ success: false, error: 'Content keys do not match' })
    }

    record = await prisma.translatedContent.update({
      data: {
        content: req.body.content,
        locked: true,
      },
      where: {
        id: Number(record.id),
      },
    })

    record = _.pick(record, ['key', 'content'])
    res.json({ success: true, record })
  } catch (err) {
    errorHandler(res, err)
  }
})

module.exports = router
