const subject = require('../skillScoresMRBasic.util')

const perfectSliceGroups = [
  {
    scores: {
      thickness: 100,
      spacing: 100,
      inplaneRotationAngle: 100,
      angle: 100,
      coverageZ: 100,
      coverageX: 100,
      coverageY: 100,
      dimensionX: 100,
      dimensionY: 100,
    },
  },
]

const midSliceGroups = [
  {
    scores: {
      thickness: 50,
      spacing: 50,
      inplaneRotationAngle: 50,
      angle: 50,
      coverageZ: 50,
      coverageX: 50,
      coverageY: 50,
      dimensionX: 50,
      dimensionY: 50,
    },
  },
]

describe('SkillsScoresMRBasicUtil', () => {
  describe('#calculateThicknessSpacing', () => {
    describe('when spacing is present', () => {
      it('should return skillScore of 100 when all components are 100', () => {
        expect(subject.calculateThicknessSpacing(perfectSliceGroups).skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        expect(subject.calculateThicknessSpacing(midSliceGroups).skillScore).toBeCloseTo(50)
      })
    })

    describe('when spacing is null (single-slice mode)', () => {
      const noSpacingGroups = [{ scores: { thickness: 100, spacing: null } }]
      const noSpacingMid = [{ scores: { thickness: 50, spacing: null } }]

      it('should return skillScore of 100 when thickness is 100', () => {
        expect(subject.calculateThicknessSpacing(noSpacingGroups).skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when thickness is 50', () => {
        expect(subject.calculateThicknessSpacing(noSpacingMid).skillScore).toBeCloseTo(50)
      })
    })
  })

  describe('#calculatePhaseFrequencyEncoding', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculatePhaseFrequencyEncoding(perfectSliceGroups).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculatePhaseFrequencyEncoding(midSliceGroups).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateAngulation', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateAngulation(perfectSliceGroups).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateAngulation(midSliceGroups).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateCoverage', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateCoverage(perfectSliceGroups).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateCoverage(midSliceGroups).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateFieldOfView', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateFieldOfView(perfectSliceGroups).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateFieldOfView(midSliceGroups).skillScore).toBeCloseTo(50)
    })
  })
})
