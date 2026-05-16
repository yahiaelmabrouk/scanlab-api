const SkillsScoresContrastUtil = {
  calculateScores(sliceQuantScore) {
    console.log('===============skills grading calculate scores========================')
    const skillsGrading = {
      contrastParameters: this.calculateContrastParameters(sliceQuantScore),
      thicknessSpacing: this.calculateThicknessSpacing(sliceQuantScore),
      phaseFrequencyEncoding: this.calculatePhaseFrequencyEncoding(sliceQuantScore),
      angulation: this.calculateAngulation(sliceQuantScore),
      coverage: this.calculateCoverage(sliceQuantScore),
      fieldOfView: this.calculateFieldOfView(sliceQuantScore),
    }
    console.log(skillsGrading)

    return skillsGrading
  },
  calculateContrastParameters(sliceQuantScore) {
    let output = {
      skillName: 'Contrast Parameters',
      componentScores: {
        repetitionTime: sliceQuantScore.parameterScore.repetitionTime,
        echoTime: sliceQuantScore.parameterScore.echoTime,
        inversionRecovery: sliceQuantScore.parameterScore.inversionRecovery,
        flipAngle: sliceQuantScore.parameterScore.flipAngle,
      },
      skillScore:
        sliceQuantScore.parameterScore.repetitionTime * 0.25 +
        sliceQuantScore.parameterScore.echoTime * 0.25 +
        sliceQuantScore.parameterScore.inversionRecovery * 0.25 +
        sliceQuantScore.parameterScore.flipAngle * 0.25,
    }
    return output
  },
  calculateThicknessSpacing(sliceQuantScore) {
    let output = {
      skillName: 'Thickness/ Spacing',
      componentScores: {
        sliceThickness: sliceQuantScore.slicePrescriptionScore.thickness,
        sliceGap: sliceQuantScore.slicePrescriptionScore.spacing,
      },
      skillScore:
        sliceQuantScore.slicePrescriptionScore.thickness * 0.5 + sliceQuantScore.slicePrescriptionScore.spacing * 0.5,
    }
    return output
  },
  calculatePhaseFrequencyEncoding(sliceQuantScore) {
    let output = {
      skillName: 'Phase/ Frequency Encoding',
      componentScores: {
        inplaneRotationAngle: sliceQuantScore.slicePrescriptionScore.inplaneRotationAngle,
      },
      skillScore: sliceQuantScore.slicePrescriptionScore.inplaneRotationAngle,
    }
    return output
  },
  calculateAngulation(sliceQuantScore) {
    let output = {
      skillName: 'Angulation',
      componentScores: {
        angle: sliceQuantScore.slicePrescriptionScore.angle,
      },
      skillScore: sliceQuantScore.slicePrescriptionScore.angle,
    }
    return output
  },
  calculateCoverage(sliceQuantScore) {
    let output = {
      skillName: 'Coverage',
      componentScores: {
        sliceCoverage: sliceQuantScore.slicePrescriptionScore.coverageZ,
        phaseCoverage: sliceQuantScore.slicePrescriptionScore.coverageX,
        frequencyCoverage: sliceQuantScore.slicePrescriptionScore.coverageY,
      },
      skillScore:
        sliceQuantScore.slicePrescriptionScore.coverageZ * 0.4 +
        sliceQuantScore.slicePrescriptionScore.coverageX * 0.3 +
        sliceQuantScore.slicePrescriptionScore.coverageY * 0.3,
    }
    return output
  },
  calculateFieldOfView(sliceQuantScore) {
    let output = {
      skillName: 'Field of View',
      componentScores: {
        dimensionX: sliceQuantScore.slicePrescriptionScore.dimensionX,
        dimensionY: sliceQuantScore.slicePrescriptionScore.dimensionY,
      },
      skillScore:
        sliceQuantScore.slicePrescriptionScore.dimensionX * 0.5 +
        sliceQuantScore.slicePrescriptionScore.dimensionY * 0.5,
    }
    return output
  },
}

module.exports = SkillsScoresContrastUtil
