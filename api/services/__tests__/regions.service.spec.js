const db = require('../../../db/models')

const subject = require('../regions.service')

jest.mock('../../../db/models', () => {
  return {
    BodyPart: {
      findAll: jest.fn(),
    },
    DicomFileSet: {
      findAll: jest.fn(),
    },
    QuestionSet: {
      findAll: jest.fn(),
    },
    Region: {
      findAll: jest.fn(),
    },
  }
})

describe('regions.service', () => {
  describe('#findAllRegions', () => {
    it('should return all Regions', async () => {
      const regions = []

      db.Region.findAll = jest.fn(() => {
        return regions
      })

      const response = { json: jest.fn(() => response) }

      await subject.findAllRegions(response)

      expect(response.json).toHaveBeenCalledWith({ success: true, regions })
    })
  })

  describe('#findTestableRegions', () => {
    it('should return all testable Regions', async () => {
      const regions = []

      const query = {
        order: [['name', 'DESC']],
        attributes: ['id', 'name', 'anatomicalOrder'],
        include: [
          {
            model: db.BodyPart,
            required: true,
            as: 'bodyParts',
            attributes: ['id', 'name'],
            include: [
              {
                model: db.QuestionSet,
                required: true,
                as: 'questionSets',
                attributes: ['id'],
                where: {
                  isAvailable: true,
                },
                include: [
                  {
                    model: db.DicomFileSet,
                    required: true,
                    as: 'DicomFileSet',
                    attributes: ['type'],
                  },
                ],
              },
            ],
          },
        ],
      }

      db.Region.findAll = jest.fn(() => {
        return regions
      })

      const response = { json: jest.fn(() => response) }

      await subject.findTestableRegions(response)

      expect(db.Region.findAll).toHaveBeenCalledWith(query)
      expect(response.json).toHaveBeenCalledWith({ success: true, regions })
    })
  })
})
