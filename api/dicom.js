const _ = require('lodash')
const logger = require('../util/logger')
const { v4: uuidv4 } = require('uuid')
const express = require('express')
const DicomSvc = require('./services/dicom.service')
const { fetchLoggedInUser, requireAdmin, isAdmin, errorHandler } = require('./api_util/api_util')
const { Upload, DicomFileSet, Region, BodyPart, sequelize } = require('../db/models')
const { S3_BUCKET, createPresignedPost, copyObject, deleteObject } = require('./api_util/aws')

const router = express.Router()

// Just for Dicom right now
// Based on https://www.shanestillwell.com/2018/09/02/amazon-file-upload/
router.post('/fileUpload', fetchLoggedInUser, requireAdmin, async function (req, res) {
  // To really support long filenames, it needs to be trimmed here (before the dot, if any...) for the path; the full filename is stored on the upload on completion regardless
  if (!_.isString(req.query.filename)) {
    res.status(200).json({ success: false, error: 'Invalid filename' })
  } else {
    const pathKey = `uploading/${uuidv4()}/${req.query.filename}`
    logger.info('Uploading to presigned key: ' + pathKey)

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createPresignedPost-property
    const response = await createPresignedPost(pathKey, S3_BUCKET, 'application/octet-stream')

    // In the format for use with Vue2Dropzone:
    // https://rowanwins.github.io/vue-dropzone/docs/dist/#/aws-S3-upload
    res.json({
      postEndpoint: response.url,
      signature: response.fields,
    })
  }
})

// Upload complete - move file in bucket, create DB representation
// id
// uploader_user_id
// path_key
// Pass in dicomId to associate new upload with existing Dicom
router.post('/fileUploadComplete', fetchLoggedInUser, requireAdmin, async function (req, res) {
  const sourcePathKey = req.query.pathKey
  const filename = req.query.filename
  if (!sourcePathKey || !_.isString(filename) || !sourcePathKey.startsWith('uploading/')) {
    res.status(200).json({ success: false, error: 'Invalid pathKey / filename' })
  } else {
    const existingDicomId = req.query.dicomId
    logger.info(`Completing upload ${sourcePathKey} ${existingDicomId}`)
    let filenameShort = _.last(_.split(sourcePathKey, '/'))
    let targetPathKey = `uploaded/${uuidv4()}/${filenameShort}`

    let dicomFileSet
    if (existingDicomId) {
      // attach upload to existing DicomFileSet
      dicomFileSet = await DicomFileSet.findByPk(existingDicomId)
      if (!dicomFileSet) {
        logger.info(`Could not find dicom ${existingDicomId} for fileUploadComplete: ${filename}`)
        res.json({ success: false })
        return
      }
    }

    try {
      // many AWS functions support .promise() https://aws.amazon.com/blogs/developer/support-for-promises-in-the-sdk/

      // First copy the tmp uploading/ file to its permanent home in uploaded/
      // will throw an error when that key doesn't exist

      await copyObject(S3_BUCKET, `/${S3_BUCKET}/${sourcePathKey}`, targetPathKey)

      // Delete the old location
      await deleteObject(S3_BUCKET, sourcePathKey)

      // Transaction http://docs.sequelizejs.com/manual/transactions.html
      await sequelize.transaction(async function (transaction) {
        // Create Upload
        let upload = await Upload.create(
          {
            filename,
            pathKey: targetPathKey,
          },
          { transaction }
        )

        // Create DicomFileSet if we didn't look one up to attach to existing
        if (!dicomFileSet) {
          dicomFileSet = await DicomFileSet.create(
            {
              name: filename,
            },
            { transaction }
          )
        }
        // Associate them
        await dicomFileSet.addUpload(upload, { transaction })

        logger.info('Upload complete: ' + targetPathKey + ' D:' + dicomFileSet.id + ' U:' + upload.id)

        res.json({ success: true, dicomFileSetId: dicomFileSet.id, uploadId: upload.id })
      })
    } catch (e) {
      logger.error(e)
      res.json({ success: false })
    }
  }
})

router.get('/dicomFileSets', fetchLoggedInUser, async function (req, res) {
  // { offset: 10, limit: 2 }
  //   order: [['createdAt', 'DESC']]

  // this is used on the home page by users to get list of Dicom that they may view in "Playground" mode
  let limitToViewOnlyAllowed = req.query.userViewOnlyAllowed

  // only admins can ask for all Dicom
  if (!limitToViewOnlyAllowed && !isAdmin(req.session.user)) {
    res.status(403).send('')
    return
  }

  let whereClause = limitToViewOnlyAllowed ? { userViewOnlyAllowed: true } : {}

  if (_.has(req.query, ['dicomCategory'])) {
    whereClause.dicomCategory = req.query.dicomCategory
  }

  // Build the include list; only eager-load uploads for admin requests to
  // avoid an N+1 query (one getUploads() call per DicomFileSet record).
  const includeList = [
    {
      model: Region,
      as: 'region',
      attributes: ['id', 'name'],
    },
    {
      model: BodyPart,
      as: 'bodyPart',
      attributes: ['id', 'name'],
    },
  ]

  if (!limitToViewOnlyAllowed) {
    includeList.push({
      model: Upload,
      as: 'Uploads',
      attributes: ['id', 'filename'],
      through: { attributes: [] }, // exclude join-table columns from output
    })
  }

  let dicoms = await DicomFileSet.findAll({
    order: [['createdAt', 'DESC']],
    where: whereClause,
    include: includeList,
  })

  let results = []

  for (let dicom of dicoms) {
    let dicomOutput = _.pick(dicom, [
      'id',
      'name',
      'userId',
      'regionId',
      'bodyPartId',
      'flipSagittal',
      'flipAxial',
      'flipCoronal',
      'userViewOnlyAllowed',
      'type',
      'linkedDicoms',
      'localizerNames',
      'isUltraLab',
      'dicomCategory',
      'localizerBoundingBoxes',
      'scanBoundingBoxes',
      'availablePositions',
    ])
    dicomOutput.regionName = _.get(dicom, 'region.name')
    dicomOutput.bodyPartName = _.get(dicom, 'bodyPart.name')

    // Uploads were already eager-loaded in the single findAll query above —
    // no extra DB round-trip per record.
    if (!limitToViewOnlyAllowed) {
      const sortedUploads = _.sortBy(dicom.Uploads, 'filename')
      dicomOutput.uploads = _.map(sortedUploads, function (upload) {
        return {
          id: upload.id,
          filename: upload.filename,
        }
      })
    }

    results.push(dicomOutput)
  }

  res.json(results)
})

router.post('/dicomFileSets', fetchLoggedInUser, requireAdmin, async function (req, res) {
  let dicomFileSet = await DicomFileSet.create(
    _.pick(req.body, [
      'name',
      'regionId',
      'bodyPartId',
      'flipSagittal',
      'flipAxial',
      'flipCoronal',
      'type',
      'linkedDicoms',
      'localizerNames',
      'isUltraLab',
      'dicomCategory',
      'localizerBoundingBoxes',
      'scanBoundingBoxes',
      'availablePositions',
    ])
  )

  res.json({ success: true, dicomFileSet })
})

router
  .route('/dicomFileSets/:id')
  .all(async function (req, res, next) {
    // runs for all HTTP verbs first
    // Fetch dicomFileSet first
    req.dicomFileSet = await DicomSvc.findDicomById(req.params.id)
    if (!req.dicomFileSet) {
      res.status(404).json({ success: false })
    } else {
      next()
    }
  })
  // Get DicomFileSet
  .get(async function (req, res) {
    res.json(await DicomSvc.getSignedUrls(req.dicomFileSet))
  })
  .post(fetchLoggedInUser, requireAdmin, async function (req, res) {
    let dicom = req.dicomFileSet
    let {
      name,
      regionId,
      bodyPartId,
      flipSagittal,
      flipAxial,
      flipCoronal,
      userViewOnlyAllowed,
      type,
      linkedDicoms,
      isUltraLab,
      dicomCategory,
      availablePositions,
    } = req.body
    if (!_.isString(name) && name.length > 0) {
      res.status(400).json({ success: false })
    } else {
      _.extend(dicom, {
        name,
        regionId,
        bodyPartId,
        flipSagittal,
        flipAxial,
        flipCoronal,
        userViewOnlyAllowed,
        type,
        linkedDicoms,
        isUltraLab,
        dicomCategory,
        availablePositions,
      })
      await dicom.save()
      res.json({ success: true })
    }
  })
  .put(fetchLoggedInUser, requireAdmin, async function (req, res) {
    let dicom = req.dicomFileSet
    let data = _.pick(req.body, ['localizerBoundingBoxes', 'scanBoundingBoxes'])
    _.extend(dicom, data)
    await dicom.save()
    res.json({ success: true })
  })
  // Delete DicomFileSet and its Uploads
  .delete(fetchLoggedInUser, requireAdmin, async function (req, res) {
    // http://docs.sequelizejs.com/manual/instances.html#destroying---deleting-persistent-instances
    let uploads = await req.dicomFileSet.getUploads()
    let uploadPathKeys = _.map(uploads, 'pathKey')

    // Delete from DB
    await sequelize.transaction(async function (transaction) {
      // Delete all relationships from Dicom to Uploads
      await req.dicomFileSet.setUploads([], { transaction })
      // Delete Uploads themselves
      for (let upload of uploads) {
        logger.info('Deleting upload ' + upload.id + ' from db')
        await upload.destroy({ transaction })
      }
      // Delete DicomFileSet
      await req.dicomFileSet.destroy({ transaction })
    })

    // Delete the files of the uploads from S3
    for (let pathKey of uploadPathKeys) {
      // Just try to delete them, if they are already gone or such, probably fine
      try {
        logger.info('Deleting uploaded file from S3: ' + pathKey)
        await deleteObject(S3_BUCKET, pathKey)
      } catch (e) {
        logger.info('Could not delete uploaded pathKey in S3: ' + pathKey)
      }
    }

    res.json({ success: true })
  })

router.patch('/dicomFileSets/:id', fetchLoggedInUser, requireAdmin, async function (req, res) {
  try {
    const dicomFileSet = await DicomSvc.findDicomById(req.params.id)
    if (dicomFileSet === null) {
      res.status(404).json({ success: false })
      return
    }

    if (!dicomFileSet.localizerNames) {
      dicomFileSet.localizerNames = {}
    }

    const { localizerNames } = req.body

    Object.assign(dicomFileSet.localizerNames, localizerNames)

    dicomFileSet.changed('localizerNames', true)
    await dicomFileSet.save()

    res.json({ success: true, dicomFileSet })
  } catch (err) {
    errorHandler(res, err)
  }
})

module.exports = router
