const subject = require('../skillScoresUltraLab.util')

const perfectScore = {
  parameterScore: {
    repetitionTime: 100,
    echoTime: 100,
    inversionRecovery: 100,
    flipAngle: 100,
    concatenations: 100,
    bValueUpper: 100,
    bValueLower: 100,
    numBValues: 100,
    phaseVoxelSize: 100,
    frequencyVoxelSize: 100,
    pixelShift: 100,
    trEfficiency: 100,
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
  imageResultScore: {
    snr: 100,
    scanTime: 100,
    pixelShift: 100,
    trEfficiency: 100,
  },
}

const midScore = {
  parameterScore: {
    repetitionTime: 50,
    echoTime: 50,
    inversionRecovery: 50,
    flipAngle: 50,
    concatenations: 50,
    bValueUpper: 50,
    bValueLower: 50,
    numBValues: 50,
    phaseVoxelSize: 50,
    frequencyVoxelSize: 50,
    pixelShift: 50,
    trEfficiency: 50,
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
  imageResultScore: {
    snr: 50,
    scanTime: 50,
    pixelShift: 50,
    trEfficiency: 50,
  },
}

describe('SkillsScoresUltralabUtil', () => {
  describe('#calculateContrastParameters', () => {
    describe('with concatenations, not diffusion', () => {
      const modifiers = { gradeContats: true, hasSpecialtyOptions: false }

      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastParameters(perfectScore, modifiers)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastParameters(midScore, modifiers)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })

    describe('with concatenations and diffusion', () => {
      const modifiers = { gradeContats: true, hasSpecialtyOptions: true, specialtyOption: 'Diffusion' }

      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastParameters(perfectScore, modifiers)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastParameters(midScore, modifiers)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })

    describe('without concatenations, not diffusion', () => {
      const modifiers = { gradeContats: false, hasSpecialtyOptions: false }

      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastParameters(perfectScore, modifiers)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastParameters(midScore, modifiers)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })

    describe('without concatenations and with diffusion', () => {
      const modifiers = { gradeContats: false, hasSpecialtyOptions: true, specialtyOption: 'Diffusion' }

      it('should return skillScore of 100 when all components are 100', () => {
        const result = subject.calculateContrastParameters(perfectScore, modifiers)
        expect(result.skillScore).toBeCloseTo(100)
      })

      it('should return skillScore of 50 when all components are 50', () => {
        const result = subject.calculateContrastParameters(midScore, modifiers)
        expect(result.skillScore).toBeCloseTo(50)
      })
    })
  })

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

  describe('#calculateSnrImageResult', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateSnrImageResult(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateSnrImageResult(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateTime', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateTime(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateTime(midScore).skillScore).toBeCloseTo(50)
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

  describe('#calculatePixelShift', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculatePixelShift(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculatePixelShift(midScore).skillScore).toBeCloseTo(50)
    })
  })

  describe('#calculateTrEfficiency', () => {
    it('should return skillScore of 100 when all components are 100', () => {
      expect(subject.calculateTrEfficiency(perfectScore).skillScore).toBeCloseTo(100)
    })

    it('should return skillScore of 50 when all components are 50', () => {
      expect(subject.calculateTrEfficiency(midScore).skillScore).toBeCloseTo(50)
    })
  })
})
