const SkillsScoresUltralabUtil = {
  calculateScores(sliceQuantScore, modifiers) {
    console.log('===============slice quant score========================')
    //console.log(sliceQuantScore)
    //console.log('===============modifiers========================')
    //console.log(modifiers)
    //
    //console.log('===============skills grading calculate scores========================')
    const skillsGrading = {
      contrastParameters: this.calculateContrastParameters(sliceQuantScore, modifiers),
      spatialResolution: this.calculateSpatialResolution(sliceQuantScore),
      thicknessSpacing: this.calculateThicknessSpacing(sliceQuantScore),
      phaseFrequencyEncoding: this.calculatePhaseFrequencyEncoding(sliceQuantScore),
      snrImageResult: this.calculateSnrImageResult(sliceQuantScore),
      time: this.calculateTime(sliceQuantScore),
      angulation: this.calculateAngulation(sliceQuantScore),
      coverage: this.calculateCoverage(sliceQuantScore),
      fieldOfView: this.calculateFieldOfView(sliceQuantScore),
    }

    if (modifiers && !modifiers.dontGradeEfficiency) {
      skillsGrading['trEfficiency'] = this.calculateTrEfficiency(sliceQuantScore)
    }
    if (modifiers && !modifiers.dontGradePixelShift) {
      skillsGrading['pixelShift'] = this.calculatePixelShift(sliceQuantScore)
    }

    //console.log(skillsGrading)

    return skillsGrading
  },
  calculateContrastParameters(sliceQuantScore, modifiers) {
    const gradeConcatenations = modifiers.gradeContats
    const isDiffusion = modifiers.hasSpecialtyOptions && modifiers.specialtyOption === 'Diffusion'
    //console.log('isDiffusion', isDiffusion)
    let output = {
      skillName: 'Contrast Parameters',
    }

    if (gradeConcatenations) {
      if (isDiffusion) {
        console.log('sliceQuantScore.parameterScore')
        console.log(sliceQuantScore.parameterScore)
        output.componentScores = {
          repetitionTime: sliceQuantScore.parameterScore.repetitionTime,
          echoTime: sliceQuantScore.parameterScore.echoTime,
          inversionRecovery: sliceQuantScore.parameterScore.inversionRecovery,
          flipAngle: sliceQuantScore.parameterScore.flipAngle,
          concatenations: sliceQuantScore.parameterScore.concatenations,
          bValueUpper: sliceQuantScore.parameterScore.bValueUpper,
          bValueLower: sliceQuantScore.parameterScore.bValueLower,
          numBValues: sliceQuantScore.parameterScore.numBValues,
        }
        output.skillScore =
          sliceQuantScore.parameterScore.repetitionTime * 0.125 +
          sliceQuantScore.parameterScore.echoTime * 0.125 +
          sliceQuantScore.parameterScore.inversionRecovery * 0.125 +
          sliceQuantScore.parameterScore.flipAngle * 0.125 +
          sliceQuantScore.parameterScore.concatenations * 0.125 +
          sliceQuantScore.parameterScore.bValueUpper * 0.125 +
          sliceQuantScore.parameterScore.bValueLower * 0.125 +
          sliceQuantScore.parameterScore.numBValues * 0.125
      } else {
        output.componentScores = {
          repetitionTime: sliceQuantScore.parameterScore.repetitionTime,
          echoTime: sliceQuantScore.parameterScore.echoTime,
          inversionRecovery: sliceQuantScore.parameterScore.inversionRecovery,
          flipAngle: sliceQuantScore.parameterScore.flipAngle,
          concatenations: sliceQuantScore.parameterScore.concatenations,
        }
        output.skillScore =
          sliceQuantScore.parameterScore.repetitionTime * 0.2 +
          sliceQuantScore.parameterScore.echoTime * 0.2 +
          sliceQuantScore.parameterScore.inversionRecovery * 0.2 +
          sliceQuantScore.parameterScore.flipAngle * 0.2 +
          sliceQuantScore.parameterScore.concatenations * 0.2
      }
    } else {
      if (isDiffusion) {
        output.componentScores = {
          repetitionTime: sliceQuantScore.parameterScore.repetitionTime,
          echoTime: sliceQuantScore.parameterScore.echoTime,
          inversionRecovery: sliceQuantScore.parameterScore.inversionRecovery,
          flipAngle: sliceQuantScore.parameterScore.flipAngle,
          bValueUpper: sliceQuantScore.parameterScore.bValueUpper,
          bValueLower: sliceQuantScore.parameterScore.bValueLower,
          numBValues: sliceQuantScore.parameterScore.numBValues,
        }
        output.skillScore =
          sliceQuantScore.parameterScore.repetitionTime * 0.15 +
          sliceQuantScore.parameterScore.echoTime * 0.15 +
          sliceQuantScore.parameterScore.inversionRecovery * 0.14 +
          sliceQuantScore.parameterScore.flipAngle * 0.14 +
          sliceQuantScore.parameterScore.bValueUpper * 0.14 +
          sliceQuantScore.parameterScore.bValueLower * 0.14 +
          sliceQuantScore.parameterScore.numBValues * 0.14
      } else {
        output.componentScores = {
          repetitionTime: sliceQuantScore.parameterScore.repetitionTime,
          echoTime: sliceQuantScore.parameterScore.echoTime,
          inversionRecovery: sliceQuantScore.parameterScore.inversionRecovery,
          flipAngle: sliceQuantScore.parameterScore.flipAngle,
        }
        output.skillScore =
          sliceQuantScore.parameterScore.repetitionTime * 0.25 +
          sliceQuantScore.parameterScore.echoTime * 0.25 +
          sliceQuantScore.parameterScore.inversionRecovery * 0.25 +
          sliceQuantScore.parameterScore.flipAngle * 0.25
      }
    }
    return output
  },
  calculateSpatialResolution(sliceQuantScore) {
    let output = {
      skillName: 'Spatial Resolution',
      componentScores: {
        phaseVoxelSize: sliceQuantScore.parameterScore.phaseVoxelSize,
        frequencyVoxelSize: sliceQuantScore.parameterScore.frequencyVoxelSize,
      },
      skillScore:
        sliceQuantScore.parameterScore.phaseVoxelSize * 0.5 + sliceQuantScore.parameterScore.frequencyVoxelSize * 0.5,
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
  calculateSnrImageResult(sliceQuantScore) {
    //Establish acceptable range of noise values
    //that we add to the resulting Images
    let output = {
      skillName: 'SNR of Resulting Images',
      componentScores: {
        snr: sliceQuantScore.imageResultScore.snr,
      },
      skillScore: sliceQuantScore.imageResultScore.snr,
    }
    return output
  },
  calculateTime(sliceQuantScore) {
    //Ranges per question
    let output = {
      skillName: 'Time',
      componentScores: {
        scanTime: sliceQuantScore.imageResultScore.scanTime,
      },
      skillScore: sliceQuantScore.imageResultScore.scanTime,
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
  calculatePixelShift(sliceQuantScore) {
    let output = {
      skillName: 'Pixel Shift',
      componentScores: {
        pixelShift: sliceQuantScore.imageResultScore.pixelShift,
      },
      skillScore: sliceQuantScore.imageResultScore.pixelShift,
    }
    return output
  },
  calculateTrEfficiency(sliceQuantScore) {
    let output = {
      skillName: 'TR Efficiency',
      componentScores: {
        trEfficiency: sliceQuantScore.imageResultScore.trEfficiency,
      },
      skillScore: sliceQuantScore.imageResultScore.trEfficiency,
    }
    return output
  },
}

module.exports = SkillsScoresUltralabUtil
