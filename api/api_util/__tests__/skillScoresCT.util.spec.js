const subject = require('../skillScoresCT.util')

const perfectScore = {
  parameterScore: {
    windowLevel: 100,
    windowWidth: 100,
    kernel: 100,
    breathingInstruction: 100,
    contrastFlow: 100,
    salineFlow: 100,
    delayTime: 100,
    isPressInjectBeforePressScanButton: 100,
    imageDurationShorterThanContrastDurationPercent: 100,
    startTooEarlySeconds: 100,
    endTooLateSeconds: 100,
  },
  slicePrescriptionScore: {
    coverageZ: 100,
    coverageX: 100,
    coverageY: 100,
    dimensionX: 100,
    dimensionY: 100,
    thickness: 100,
    spacing: 100,
    angle: 100,
  },
}

const midScore = {
  parameterScore: {
    windowLevel: 50,
    windowWidth: 50,
    kernel: 50,
    breathingInstruction: 50,
    contrastFlow: 50,
    salineFlow: 50,
    delayTime: 50,
    isPressInjectBeforePressScanButton: 50,
    imageDurationShorterThanContrastDurationPercent: 50,
    startTooEarlySeconds: 50,
    endTooLateSeconds: 50,
  },
  slicePrescriptionScore: {
    coverageZ: 50,
    coverageX: 50,
    coverageY: 50,
    dimensionX: 50,
    dimensionY: 50,
    thickness: 50,
    spacing: 50,
    angle: 50,
  },
}

describe('SkillsScoresCTUtil', () => {
  describe('#calculateReconParameterManipulation', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      const result = subject.calculateReconParameterManipulation(perfectScore)
      expect(result.skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      const result = subject.calculateReconParameterManipulation(midScore)
      expect(result.skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateReconPrescription', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      const result = subject.calculateReconPrescription(perfectScore)
      expect(result.skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      const result = subject.calculateReconPrescription(midScore)
      expect(result.skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateAcqParameterManipulation', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      const result = subject.calculateAcqParameterManipulation(perfectScore)
      expect(result.skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      const result = subject.calculateAcqParameterManipulation(midScore)
      expect(result.skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateAcqPrescription', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      const result = subject.calculateAcqPrescription(perfectScore)
      expect(result.skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      const result = subject.calculateAcqPrescription(midScore)
      expect(result.skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateContrastInjector', () => {
    describe('when isContrastOnly is true', () => {
      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastInjector(perfectScore, true)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastInjector(midScore, true)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })

    describe('when isContrastOnly is false', () => {
      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastInjector(perfectScore, false)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastInjector(midScore, false)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })
  })

  describe('#calculateAcqContrastImageTiming', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      const result = subject.calculateAcqContrastImageTiming(perfectScore)
      expect(result.skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      const result = subject.calculateAcqContrastImageTiming(midScore)
      expect(result.skillScore).toBeCloseTo(50)
    })
  })
})
