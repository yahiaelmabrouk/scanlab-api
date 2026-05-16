const { BodyPart, DicomFileSet, QuestionSet, Region } = require('../../db/models')

const RegionsSvc = {
  findAllRegions: async function (res) {
    const regions = await Region.findAll({
      order: [['name', 'DESC']],
      attributes: ['id', 'name', 'anatomicalOrder'],
    })

    res.json({ success: true, regions })
  },

  findTestableRegions: async function (res) {
    let regions = await Region.findAll({
      order: [['name', 'DESC']],
      attributes: ['id', 'name', 'anatomicalOrder'],
      include: [
        {
          model: BodyPart,
          required: true,
          as: 'bodyParts',
          attributes: ['id', 'name'],
          include: [
            {
              model: QuestionSet,
              required: true,
              as: 'questionSets',
              attributes: ['id'],
              where: {
                isAvailable: true,
              },
              include: [
                {
                  model: DicomFileSet,
                  required: true,
                  as: 'DicomFileSet',
                  attributes: ['type'],
                },
              ],
            },
          ],
        },
      ],
    })
    res.json({ success: true, regions })
  },
}

module.exports = RegionsSvc
