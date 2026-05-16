const _ = require('lodash')
const { DicomFileSet, BodyPart } = require('../../db/models')
const { getUploadUrl } = require('../api_util/aws')

const DicomSvc = {
  findDicomById: async function (id) {
    return await DicomFileSet.findOne({
      where: { id },
      include: [
        {
          model: BodyPart,
          as: 'bodyPart',
          attributes: ['name'],
        },
      ],
    })
  },

  getSignedUrls: async function (dicomFileSet) {
    let uploadObjects = await dicomFileSet.getUploads({
      order: [['filename', 'ASC']],
    })

    let uploads = await Promise.all(_.map(uploadObjects, async function (upload) {
      return { url: await getUploadUrl(upload.pathKey), id: upload.id, filename: upload.filename }
    }))

    let bodyPartName = await dicomFileSet.bodyPart?.name
    // Dicom that is Resolution Lab is marked with (Resolution Lab) in the Dicom's BodyPart.name
    let isResolutionLab = _.includes(bodyPartName, '(Resolution Lab)')

    return _.extend(
      _.pick(dicomFileSet, [
        'id',
        'name',
        'userId',
        'regionId',
        'bodyPartId',
        'flipSagittal',
        'flipAxial',
        'flipCoronal',
        'type',
        'linkedDicoms',
        'localizerNames',
        'localizerBoundingBoxes',
        'scanBoundingBoxes',
        'availablePositions',
      ]),
      {
        uploads,
        isResolutionLab,
      }
    )
  },
}

module.exports = DicomSvc
