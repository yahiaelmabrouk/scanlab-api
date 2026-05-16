const SkillsScoresCTUtil = {
  calculateScores(sliceQuantScore, modifiers) {
    console.log('===============CT skills grading calculate scores========================')
    //console.log('sliceQuantScore', sliceQuantScore)
    if (!sliceQuantScore) {
      return {}
    }
    let skillsGrading = {}
    if (modifiers && modifiers.isReconQuestion) {
      //console.log('is recon')
      skillsGrading.parameterManipulation = this.calculateReconParameterManipulation(sliceQuantScore)
      skillsGrading.slicePrescription = this.calculateReconPrescription(sliceQuantScore)
    } else if (modifiers && modifiers.isAcqQuestion) {
      //console.log('is acquisition')
      skillsGrading.parameterManipulation = this.calculateAcqParameterManipulation(sliceQuantScore)
      skillsGrading.slicePrescription = this.calculateAcqPrescription(sliceQuantScore)
      if (modifiers.isPostContrast) {
        //console.log('is post contrast')
        skillsGrading.contrastInjector = this.calculateContrastInjector(sliceQuantScore, modifiers.isContrastOnly)
      }
      if (modifiers.isCta) {
        skillsGrading.contrastImageTiming = this.calculateAcqContrastImageTiming(sliceQuantScore)
      }
    }
    //console.log('finished skills grading')
    return skillsGrading
  },

  calculateScreeningSafety() {
    console.log('===============CT skills grading calculate screening safety========================')
    // Patient Screening Forms
    let output = {
      skillName: 'Patient Screening and Safety',
      componentScores: {},
      skillScore: 0,
    }
    return output
  },

  calculateContrastInjector(sliceQuantScore, isContrastOnly) {
    console.log('===============CT skills grading calculate contrast injector========================')
    // Contrast Flow
    // Saline Flow
    // Delay Time
    // Contrast Volume
    // Saline Volume
    let output = {
      skillName: 'Contrast and Injector Practices',
    }

    if (isContrastOnly) {
      //console.log('is contrast only')
      output.componentScores = {
        contrastFlow: sliceQuantScore.parameterScore.contrastFlow,
        delayTime: sliceQuantScore.parameterScore.delayTime,
      }
      output.skillScore =
        sliceQuantScore.parameterScore.contrastFlow * 0.5 + sliceQuantScore.parameterScore.delayTime * 0.5
    } else {
      //console.log('is contrast and saline')
      output.componentScores = {
        contrastFlow: sliceQuantScore.parameterScore.contrastFlow,
        salineFlow: sliceQuantScore.parameterScore.salineFlow,
        delayTime: sliceQuantScore.parameterScore.delayTime,
      }
      output.skillScore =
        sliceQuantScore.parameterScore.contrastFlow * 0.3 +
        sliceQuantScore.parameterScore.salineFlow * 0.3 +
        sliceQuantScore.parameterScore.delayTime * 0.4
    }
    return output
  },

  calculatePositioningIneraction() {
    console.log('===============CT skills grading calculate positioning interaction========================')
    // Patient Position
    // S/I Landmarking
    // A/P Landmarking
    let output = {
      skillName: 'Patient Positioning and Interactions',
      componentScores: {},
      skillScore: 0,
    }
    return output
  },

  calculateReconPrescription(sliceQuantScore) {
    console.log('===============CT skills grading calculate recon prescription========================')
    //Slice Coverage
    //Field Of View
    //Slice Thickness
    //Gap
    //Angulation

    let output = {
      skillName: 'Slice Prescription',
      componentScores: {
        sliceCoverage: sliceQuantScore.slicePrescriptionScore.coverageZ,
        phaseCoverage: sliceQuantScore.slicePrescriptionScore.coverageX,
        frequencyCoverage: sliceQuantScore.slicePrescriptionScore.coverageY,
        dimensionX: sliceQuantScore.slicePrescriptionScore.dimensionX,
        dimensionY: sliceQuantScore.slicePrescriptionScore.dimensionY,
        sliceThickness: sliceQuantScore.slicePrescriptionScore.thickness,
        sliceGap: sliceQuantScore.slicePrescriptionScore.spacing,
        angulation: sliceQuantScore.slicePrescriptionScore.angle,
      },
      skillScore:
        sliceQuantScore.slicePrescriptionScore.coverageZ * 0.13 +
        sliceQuantScore.slicePrescriptionScore.coverageX * 0.12 +
        sliceQuantScore.slicePrescriptionScore.coverageY * 0.13 +
        sliceQuantScore.slicePrescriptionScore.dimensionX * 0.12 +
        sliceQuantScore.slicePrescriptionScore.dimensionY * 0.12 +
        sliceQuantScore.slicePrescriptionScore.thickness * 0.13 +
        sliceQuantScore.slicePrescriptionScore.spacing * 0.13 +
        sliceQuantScore.slicePrescriptionScore.angle * 0.12,
    }
    return output
  },

  calculateReconParameterManipulation(sliceQuantScore) {
    console.log('===============CT skills grading calculate recon parameter manipulation========================')
    //Window
    //Kernel

    let output = {
      skillName: 'Parameter Manipulation',
      componentScores: {
        windowLevel: sliceQuantScore.parameterScore.windowLevel,
        windowWidth: sliceQuantScore.parameterScore.windowWidth,
        kernel: sliceQuantScore.parameterScore.kernel,
      },
      skillScore:
        sliceQuantScore.parameterScore.windowLevel * 0.25 +
        sliceQuantScore.parameterScore.windowWidth * 0.25 +
        sliceQuantScore.parameterScore.kernel * 0.5,
    }
    return output
  },

  calculateAcqPrescription(sliceQuantScore) {
    console.log('===============CT skills grading calculate acq prescription========================')
    //console.log(sliceQuantScore)
    //Slice Coverage
    //Field Of View
    //Slice Thickness
    //Gap
    //Angulation

    let output = {
      skillName: 'Slice Prescription',
      componentScores: {
        sliceCoverage: sliceQuantScore.slicePrescriptionScore.coverageZ,
        phaseCoverage: sliceQuantScore.slicePrescriptionScore.coverageX,
        frequencyCoverage: sliceQuantScore.slicePrescriptionScore.coverageY,
        dimensionX: sliceQuantScore.slicePrescriptionScore.dimensionX,
        dimensionY: sliceQuantScore.slicePrescriptionScore.dimensionY,
        sliceThickness: sliceQuantScore.slicePrescriptionScore.thickness,
      },
      skillScore:
        sliceQuantScore.slicePrescriptionScore.coverageZ * 0.1 +
        sliceQuantScore.slicePrescriptionScore.coverageX * 0.1 +
        sliceQuantScore.slicePrescriptionScore.coverageY * 0.1 +
        sliceQuantScore.slicePrescriptionScore.dimensionX * 0.2 +
        sliceQuantScore.slicePrescriptionScore.dimensionY * 0.2 +
        sliceQuantScore.slicePrescriptionScore.thickness * 0.4,
    }
    return output
  },

  calculateAcqParameterManipulation(sliceQuantScore) {
    console.log('===============CT skills grading calculate parameter manipulation========================')
    //Window
    //Kernel
    //Breathing Instruction

    let output = {
      skillName: 'Parameter Manipulation',
      componentScores: {
        windowLevel: sliceQuantScore.parameterScore.windowLevel,
        windowWidth: sliceQuantScore.parameterScore.windowWidth,
        kernel: sliceQuantScore.parameterScore.kernel,
        breathingInstruction: sliceQuantScore.parameterScore.breathingInstruction,
      },
      skillScore:
        sliceQuantScore.parameterScore.windowLevel * 0.15 +
        sliceQuantScore.parameterScore.windowWidth * 0.15 +
        sliceQuantScore.parameterScore.kernel * 0.35 +
        sliceQuantScore.parameterScore.breathingInstruction * 0.35,
    }
    return output
  },

  calculateAcqContrastImageTiming(sliceQuantScore) {
    console.log('===============CT skills grading calculate contrast image timing========================')
    //isPressInjectBeforePressScanButton
    //imageDurationShorterThanContrastDurationPercent
    //startTooEarlySeconds
    //endTooLateSeconds

    let output = {
      skillName: 'Contrast and Image Timing',
      componentScores: {
        isPressInjectBeforePressScanButton: sliceQuantScore.parameterScore.isPressInjectBeforePressScanButton,
        imageDurationShorterThanContrastDurationPercent:
          sliceQuantScore.parameterScore.imageDurationShorterThanContrastDurationPercent,
        startTooEarlySeconds: sliceQuantScore.parameterScore.startTooEarlySeconds,
        endTooLateSeconds: sliceQuantScore.parameterScore.endTooLateSeconds,
      },
      skillScore:
        sliceQuantScore.parameterScore.isPressInjectBeforePressScanButton * 0.25 +
        sliceQuantScore.parameterScore.imageDurationShorterThanContrastDurationPercent * 0.25 +
        sliceQuantScore.parameterScore.startTooEarlySeconds * 0.25 +
        sliceQuantScore.parameterScore.endTooLateSeconds * 0.25,
    }
    return output
  },
}

module.exports = SkillsScoresCTUtil
