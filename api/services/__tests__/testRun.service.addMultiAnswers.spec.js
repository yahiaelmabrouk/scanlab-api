const _ = require('lodash')

// ── Mocks ──────────────────────────────────────────────────────

jest.mock('../../../db/models', () => ({
  Op: { in: Symbol('in') },
  QuestionSet: {},
  CohortStudent: {},
  MultipleChoiceQuestion: { findAll: jest.fn().mockResolvedValue([]) },
  StackQuestion: { findAll: jest.fn().mockResolvedValue([]) },
  BodyPart: {},
  sequelize: {},
  InjectionAttribute: {},
  WeightBasedDose: {},
}))
jest.mock('../../api_util/aws', () => ({
  s3Upload: jest.fn(),
  getS3BucketOfRegion: jest.fn(),
}))
jest.mock('../../api_util/api_util', () => ({
  isContrastLab: jest.fn(),
  isResolutionLab: jest.fn(),
  serializeSliceViews: jest.fn(),
  getMineCohortArea: jest.fn().mockResolvedValue('US'),
  getUserInfomationFromUserModel: jest.fn(() => ({
    preferredAnswerCriteriaByStackQuestionId: {},
    save: jest.fn().mockResolvedValue(),
  })),
}))
jest.mock('../../api_util/score', () => ({
  serializeGroupScoreVariables: jest.fn(),
  calculateGroupScoreVariables: jest.fn(),
}))
jest.mock('../../../util/constants', () => ({
  categoryIds: {},
  angioExamBodyPartIds: [],
  cardiacBodyPartIds: [],
}))
jest.mock('../../providers/model.provider', () => ({}))
jest.mock('../../../util/sql', () => ({ whereObjectToSql: jest.fn() }))
jest.mock('../../statsCacheHelper', () => ({}))
jest.mock('../../../util/retrySerializable', () => ({
  retryOnSerializationError: jest.fn((fn) => fn()),
}))
jest.mock('../../api_util/middlewareCache', () => ({
  getCachedWeightBasedDoses: jest.fn(),
}))
jest.mock('../../api_util/skillScores.util', () => ({}))
jest.mock('../../api_util/skillScoresCT.util', () => ({}))
jest.mock('../../api_util/skillScoresUltraLab.util', () => ({}))
jest.mock('../../api_util/skillScoresContrast.util', () => ({}))
jest.mock('../../api_util/skillScoresResolution.util', () => ({}))
jest.mock('../../api_util/skillScoresMRBasic.util', () => ({}))
jest.mock('../../api_util/sliceQuantGradingCT.util', () => ({}))
jest.mock('../../api_util/sliceQuantGradingUltraLab.util', () => ({}))
jest.mock('../../api_util/sliceQuantGradingMRBasic.util', () => ({}))
jest.mock('../../api_util/sliceQuantGradingResolution.util', () => ({}))
jest.mock('../../api_util/sliceQuantGradingContrast.util', () => ({}))
jest.mock('../../api_util/patientPrep.util', () => ({}))
jest.mock('../criticalThinkingQuestion.service', () => ({}))
jest.mock('../questionGroup.service', () => ({}))

// ── Subject ────────────────────────────────────────────────────

const TestSvc = require('../testRun.service')

// ── Tests ──────────────────────────────────────────────────────

describe('testRun.service – addMultiAnswers', () => {
  it('should await testRun.update() so data is persisted before returning', async () => {
    const updateMock = jest.fn().mockResolvedValue()

    // Stub getTestRun to return a fake test run
    const fakeTestRun = {
      id: 'tr-1',
      userId: 1,
      timeEnded: null,
      answers: [],
      questions: [{ id: 'q1', type: 'PREQUESTION' }],
      update: updateMock,
    }
    jest.spyOn(TestSvc, 'getTestRun').mockResolvedValue(fakeTestRun)
    jest.spyOn(TestSvc, 'uploadAnswerImages').mockImplementation((_tr, a) => Promise.resolve(a))

    const user = { id: 1, userInformation: {} }
    const answers = [{ questionId: 'q1', selectedAnswer: 'a1' }]

    await TestSvc.addMultiAnswers('tr-1', answers, user)

    // update must have been called
    expect(updateMock).toHaveBeenCalledWith({ answers: expect.any(Array) })

    // Because we added `await`, the promise returned by update() must have
    // settled BEFORE addMultiAnswers resolved.  If `await` were missing the
    // mock's internal resolved-promise micro-task would still be pending.
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('should propagate errors from testRun.update()', async () => {
    const updateMock = jest.fn().mockRejectedValue(new Error('DB write failed'))

    const fakeTestRun = {
      id: 'tr-2',
      userId: 2,
      timeEnded: null,
      answers: [],
      questions: [{ id: 'q1', type: 'PREQUESTION' }],
      update: updateMock,
    }
    jest.spyOn(TestSvc, 'getTestRun').mockResolvedValue(fakeTestRun)
    jest.spyOn(TestSvc, 'uploadAnswerImages').mockImplementation((_tr, a) => Promise.resolve(a))

    const user = { id: 2, userInformation: {} }
    const answers = [{ questionId: 'q1', selectedAnswer: 'a1' }]

    await expect(TestSvc.addMultiAnswers('tr-2', answers, user)).rejects.toThrow('DB write failed')
  })
})
