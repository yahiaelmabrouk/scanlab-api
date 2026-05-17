const subject = require('../skillScoresResolution.util')

const perfectScore = {
  parameterScore: {
    phaseVoxelSize: 100,
    frequencyVoxelSize: 100,
  },
  slicePrescriptionScore: {
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
}

const midScore = {
  parameterScore: {
    phaseVoxelSize: 50,
    frequencyVoxelSize: 50,
  },
  slicePrescriptionScore: {
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
}

describe('SkillsScoresResolutionUtil', () => {
  describe('#calculateSpatialResolution', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateSpatialResolution(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateSpatialResolution(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateThicknessSpacing', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateThicknessSpacing(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateThicknessSpacing(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculatePhaseFrequencyEncoding', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculatePhaseFrequencyEncoding(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculatePhaseFrequencyEncoding(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateAngulation', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateAngulation(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateAngulation(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateCoverage', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateCoverage(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateCoverage(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateFieldOfView', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateFieldOfView(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateFieldOfView(midScore).skillScore).toBeCloseTo(50)
    })
  })
})
