const _ = require('lodash')
const { calculateGroupScoreVariables } = require('../api_util/score')

const SliceQuantGradingUltraLabUtil = {
  calculateScores(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    let scoreDetails = {}
    scoreDetails.parameterScore = this.parametersScore(answer, selectedAnswer, modifiers)
    scoreDetails.slicePrescriptionScore = this.slicePrescriptionScore(answer, selectedAnswer, modifiers)
    scoreDetails.imageResultScore = this.imageResultScore(answer, selectedAnswer, modifiers)
    scoreDetails.combinedScore = _.round(
      scoreDetails.parameterScore.combinedScore * 0.33 +
        scoreDetails.slicePrescriptionScore.combinedScore * 0.34 +
        scoreDetails.imageResultScore.combinedScore * 0.33,
      2
    )

    //console.log('++++++++++++++++++++++++++++++ Slice Quant score ++++++++++++++++++++++')
    return scoreDetails
  },

  parametersScore(answer, selectedAnswer, modifiers) {
    //console.log('++++++++++++++++++++++++++++++ Parameters score ++++++++++++++++++++++')
    const inversionRecovery = selectedAnswer['0_min'].inversionRecovery
    const overrides = this.allFactorsIgnored()
    const isDiffusion = modifiers.hasSpecialtyOptions && selectedAnswer['0_min'].specialtyOption === 'Diffusion'
    const hasMinEchoTime = isDiffusion && answer[0] && answer[0].minSeqTe !== undefined

    // Log TE grading configuration for DIFF sequences
    if (isDiffusion) {
      console.log('[UltraLab TE Grading] DIFF sequence detected:', {
        hasMinEchoTime,
        userEchoTime: answer[0]?.echoTime,
        minSeqTe: answer[0]?.minSeqTe,
        gradingMode: hasMinEchoTime ? 'proximity-based' : 'range-based',
      })
    }
    overrides.factors = {
      ...overrides.factors,
      repetitionTime: {
        ignore: false,
        scoring: {
          relativeScaleBase: 100,
          relativeScaleFactor: 3.5,
          maximumPointLoss: 100,
        },
      },
      echoTime: {
        ignore: false,
        scoring: hasMinEchoTime
          ? {
              linearFactor: 5,
              maximumPointLoss: 100,
            }
          : {
              relativeScaleBase: 100,
              relativeScaleFactor: 1,
              maximumPointLoss: 100,
            },
      },
      inversionTime: {
        ignore: !inversionRecovery,
        scoring: {
          relativeScaleBase: 100,
          relativeScaleFactor: 4.5,
          maximumPointLoss: 100,
        },
      },
      inversionRecovery: {
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
        feedback: {
          onlyShowWhenWrong: false,
        },
      },
      fatSuppression: {
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      phaseVoxelSize: {
        directional: true,
        ignore: false,
        scoringTooHigh: {
          linearFactor: 333.3,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 200,
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
      frequencyVoxelSize: {
        directional: true,
        ignore: false,
        scoringTooHigh: {
          linearFactor: 333.3,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 200,
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
      flipAngle: {
        ignore: false,
        scoring: {
          relativeScaleBase: 100,
          relativeScaleFactor: 6.5,
          maximumPointLoss: 100,
        },
      },
      concatenations: {
        ignore: !modifiers.gradeContats,
        scoring: {
          linearFactor: 1,
          maximumPointLoss: 100,
        },
      },
      sequenceType: {
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      bValueLower: {
        ignore: !isDiffusion,
      },
      bValueUpper: {
        ignore: !isDiffusion,
      },
      numBValues: {
        ignore: !isDiffusion,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
    }

    // minSeqTe override logic has been moved to calculateGroupScoreVariables in score.js
    // to handle field strength range overwrites properly

    selectedAnswer = this.adjustParameterGradingForSNR(answer, selectedAnswer, modifiers, overrides)

    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    const paramsScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      paramsScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    let combinedLoss = 0
    if (inversionRecovery) {
      if (modifiers.gradeContats) {
        if (isDiffusion) {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 + // 40
            (100 - paramsScore.echoTime) * 0.4 + // 40
            (100 - paramsScore.inversionTime) * 0.15 + // 15
            (100 - paramsScore.inversionRecovery) * 0.15 + // 15
            (100 - paramsScore.fatSuppression) * 0.2 + // 20
            (100 - paramsScore.phaseVoxelSize) * 0.2 + // 20
            (100 - paramsScore.frequencyVoxelSize) * 0.2 + // 20
            (100 - paramsScore.flipAngle) * 0.2 + // 20
            (100 - paramsScore.concatenations) * 0.2 + // 20
            (100 - paramsScore.sequenceType) * 0.5 + // 20
            (100 - paramsScore.bValueLower) * 0.2 + // 20
            (100 - paramsScore.bValueUpper) * 0.3 + // 30
            (100 - paramsScore.numBValues) * 0.2
          // add diffusion params
        } else {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 + // 40
            (100 - paramsScore.echoTime) * 0.4 + // 40
            (100 - paramsScore.inversionTime) * 0.15 + // 15
            (100 - paramsScore.inversionRecovery) * 0.15 + // 15
            (100 - paramsScore.fatSuppression) * 0.2 + // 20
            (100 - paramsScore.phaseVoxelSize) * 0.2 + // 20
            (100 - paramsScore.frequencyVoxelSize) * 0.2 + // 20
            (100 - paramsScore.flipAngle) * 0.2 + // 20
            (100 - paramsScore.concatenations) * 0.2 + // 20
            (100 - paramsScore.sequenceType) * 0.2 // 20
        }
      } else {
        if (isDiffusion) {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionTime) * 0.15 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.5 +
            (100 - paramsScore.bValueLower) * 0.2 + // 20
            (100 - paramsScore.bValueUpper) * 0.3 + // 30
            (100 - paramsScore.numBValues) * 0.2
          //add diffusion params
        } else {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionTime) * 0.15 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.2
        }
      }
    } else {
      if (modifiers.gradeContats) {
        if (isDiffusion) {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.concatenations) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.5 +
            (100 - paramsScore.bValueLower) * 0.2 + // 20
            (100 - paramsScore.bValueUpper) * 0.2 + // 20
            (100 - paramsScore.numBValues) * 0.2
          // add diffusion params
        } else {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.concatenations) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.2
        }
      } else {
        if (isDiffusion) {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.5 +
            (100 - paramsScore.bValueLower) * 0.2 + // 20
            (100 - paramsScore.bValueUpper) * 0.2 + // 20
            (100 - paramsScore.numBValues) * 0.2
          // add diffusion params
        } else {
          combinedLoss =
            (100 - paramsScore.repetitionTime) * 0.4 +
            (100 - paramsScore.echoTime) * 0.4 +
            (100 - paramsScore.inversionRecovery) * 0.15 +
            (100 - paramsScore.fatSuppression) * 0.2 +
            (100 - paramsScore.phaseVoxelSize) * 0.2 +
            (100 - paramsScore.frequencyVoxelSize) * 0.2 +
            (100 - paramsScore.flipAngle) * 0.2 +
            (100 - paramsScore.sequenceType) * 0.2
        }
      }
    }

    paramsScore.combinedScore = _.max([0, 100 - combinedLoss])

    paramsScore.groupScoreVariables = scores.groupScoreVariables
    paramsScore.rubric = scores.rubric
    return paramsScore
  },

  slicePrescriptionScore(answer, selectedAnswer, modifiers) {
    //console.log('++++++++++++++++++++++++++++++ Slice prescription score ++++++++++++++++++++++')
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      angle: {
        ignore: false,
        scoring: {
          //linearBuffer: 2,
          //linearFactor: 2,
          //quadraticBuffer: 10,
          //quadraticFactor: 0.8,
          linearInterpolationFactor: [
            [0, 0],
            [2, 10],
            [4, 20],
            [9, 50],
            [14, 100],
          ],
          linearInterpolationBuffer: 1,
          maximumPointLoss: 100,
        },
      },
      inplaneRotationAngle: {
        ignore: false,
        scoring: {
          //linearBuffer: 15,
          //linearFactor: 1.5,
          linearInterpolationFactor: [
            [0, 0],
            [5, 15],
            [15, 50],
            [30, 75],
            [45, 100],
          ],
          linearInterpolationBuffer: 15,
          maximumPointLoss: 100,
        },
      },
      thickness: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 66.66,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 50,
          maximumPointLoss: 100,
        },
      },
      spacing: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 100,
          //quadraticBuffer: 0.2,
          //quadraticFactor: 8,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 66.66,
          //quadraticBuffer: 0.5,
          //quadraticFactor: 10,
          maximumPointLoss: 100,
        },
      },
      dimensionX: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          relativeScaleBase: 100,
          relativeScaleFactor: 2,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          relativeScaleBase: 100,
          relativeScaleFactor: 5,
          maximumPointLoss: 100,
        },
      },
      dimensionY: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          relativeScaleBase: 100,
          relativeScaleFactor: 2,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          relativeScaleBase: 100,
          relativeScaleFactor: 5,
          maximumPointLoss: 100,
        },
      },
      coverageX: {
        ignore: false,
        scoring: {
          linearFactor: 2.5,
          maximumPointLoss: 100,
        },
      },
      coverageY: {
        ignore: false,
        scoring: {
          linearFactor: 2.5,
          maximumPointLoss: 100,
        },
      },
      coverageZ: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearInterpolationFactor: [
            [0, 0],
            [4, 10],
            [9, 25],
            [29, 50],
            [39, 100],
          ],
          linearInterpolationBuffer: 1,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearInterpolationFactor: [
            [0, 0],
            [2, 30],
            [9, 100],
          ],
          linearInterpolationBuffer: 1,
          maximumPointLoss: 100,
        },
      },
    }
    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    //console.log('======================scores===================')
    const slicePrescriptionScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      slicePrescriptionScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    let combinedLoss = 0
    combinedLoss =
      (100 - slicePrescriptionScore.angle) * 0.3 +
      (100 - slicePrescriptionScore.inplaneRotationAngle) * 0.5 +
      (100 - slicePrescriptionScore.thickness) * 0.2 +
      (100 - slicePrescriptionScore.spacing) * 0.11 +
      (100 - slicePrescriptionScore.dimensionX) * 0.2 +
      (100 - slicePrescriptionScore.dimensionY) * 0.2 +
      (100 - slicePrescriptionScore.coverageX) * 0.2 +
      (100 - slicePrescriptionScore.coverageY) * 0.2 +
      (100 - slicePrescriptionScore.coverageZ) * 0.3

    combinedLoss = _.round(combinedLoss, 2)
    slicePrescriptionScore.combinedScore = _.max([0, 100 - combinedLoss])

    slicePrescriptionScore.groupScoreVariables = scores.groupScoreVariables
    slicePrescriptionScore.rubric = scores.rubric
    return slicePrescriptionScore
  },

  imageResultScore(answer, selectedAnswer, modifiers) {
    //console.log('++++++++++++++++++++++++++++++ TR Time SNR Parameter score ++++++++++++++++++++++')
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      snr: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 1000,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 1000,
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
      scanTime: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 1,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 1,
          maximumPointLoss: 100,
        },
      },
      pixelShift: {
        ignore: modifiers.dontGradePixelShift,
        directional: true,
        scoringTooHigh: {
          linearFactor: 50,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 30,
          maximumPointLoss: 100,
        },
      },
      trEfficiency: {
        ignore: modifiers.dontGradeEfficiency,
        scoring: {
          linearFactor: 1,
          maximumPointLoss: 100,
        },
      },
    }

    // if the users snr is within range, grading is forgiven for some parameters
    selectedAnswer = this.adjustImageResultGradingForSNR(answer, selectedAnswer, modifiers, overrides)

    // if the users scantime is within range, grading is forgiven for some parameters
    selectedAnswer = this.adjustImageResultGradingForScanTime(answer, selectedAnswer, modifiers, overrides)

    const imageResultScore = this.calcImageResultWithModifiers(answer, selectedAnswer, modifiers, overrides)

    return imageResultScore
  },

  calculateGroupScoreVars(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    return calculateGroupScoreVariables(
      answer,
      selectedAnswer,
      {
        ignoreInPlaneRotation: modifiers.ignoreInPlaneRotation,
        isContrastLab: modifiers.isContrastLab,
        isResolutionLab: modifiers.isResolutionLab,
        isCTLab: modifiers.isCTLab,
        isUltraLab: modifiers.isUltraLab,
        isReconQuestion: modifiers.isReconQuestion,
        isAcqQuestion: modifiers.isAcqQuestion,
        isPostContrast: modifiers.isPostContrast,
        phaseNum: modifiers.phaseNum,
        questionType: modifiers.questionType,
        isCalculateScoreForPatientPrep: false,
        isProduction: modifiers.isProduction,
      },
      rubricOverride,
      attributes
    )
  },

  adjustParameterGradingForSNR(answer, selectedAnswer, modifiers, overrides) {
    const preScoreOverrides = this.allFactorsIgnored()
    preScoreOverrides.factors = {
      ...preScoreOverrides.factors,
      snr: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 5,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 5,
          maximumPointLoss: 100,
        },
      },
      phaseVoxelSize: {
        directional: true,
        ignore: false,
        scoringTooHigh: {
          linearFactor: 333.3,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 200,
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
      frequencyVoxelSize: {
        directional: true,
        ignore: false,
        scoringTooHigh: {
          linearFactor: 333.3,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 200,
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
    }

    const preScore = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, preScoreOverrides)
    const snrResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'snr')

    if (snrResult.key.match(/big|correct/)) {
      const freqVoxelSizeResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'frequency_voxel')
      const phaseVoxelSizeResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'phase_voxel')
      if (freqVoxelSizeResult.key.match(/small/)) {
        selectedAnswer['0_min'].frequencyVoxelSize = _.floor(answer[0].frequencyVoxelSize)
      }
      if (phaseVoxelSizeResult.key.match(/small/)) {
        selectedAnswer['0_min'].phaseVoxelSize = _.floor(answer[0].phaseVoxelSize)
      }
    }

    return selectedAnswer
  },

  // need to check scores first to see if scantime falls within range,
  // if so some parameters will be ok if they are over
  adjustImageResultGradingForScanTime(answer, selectedAnswer, modifiers, overrides) {
    const preScore = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    const scanTimeResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'scan_time')
    if (scanTimeResult.key.match(/small|correct/)) {
      const snrResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'snr')
      if (snrResult.key.match(/big/)) {
        selectedAnswer.fieldStrengthRanges[answer[0].fieldStrength].max.snr = _.ceil(answer[0].snr)
      }
    }
    return selectedAnswer
  },

  // recalculate to readjust analysis for further score augmentation
  // if snr falls within range, some parameters will be ok if they are under
  adjustImageResultGradingForSNR(answer, selectedAnswer, modifiers, overrides) {
    const preScore = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    const snrResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'snr')
    if (snrResult.key.match(/big|correct/)) {
      const pixelShiftResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'pixel_shift')
      const scanTimeResult = preScore.groupScoreVariables[0].analysis.find((x) => x.keyName === 'scan_time')
      if (pixelShiftResult?.key.match(/small/)) {
        selectedAnswer['0_min'].pixelShift = _.floor(answer[0].pixelShift)
      }
      if (scanTimeResult.key.match(/small/)) {
        selectedAnswer['0_min'].scanTime = _.floor(answer[0].scanTime)
      }
    }
    return selectedAnswer
  },

  calcImageResultWithModifiers(answer, selectedAnswer, modifiers, overrides) {
    const dontGradeEfficiency = modifiers.dontGradeEfficiency
    const dontGradePixelShift = modifiers.dontGradePixelShift

    const imageResultScore = {}
    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      imageResultScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    if (!dontGradeEfficiency && !dontGradePixelShift) {
      /*TR Efficiency
      Pixel Shift
      SNR
      Scan Time*/
      //console.log('modifer combo 1')
      imageResultScore.combinedScore =
        imageResultScore.trEfficiency * 0.2 +
        imageResultScore.pixelShift * 0.2 +
        imageResultScore.snr * 0.2 +
        imageResultScore.scanTime * 0.4
    } else if (!dontGradeEfficiency && dontGradePixelShift) {
      /*TR Efficiency
      SNR
      Scan Time*/
      imageResultScore.combinedScore =
        imageResultScore.trEfficiency * 0.3 + imageResultScore.snr * 0.3 + imageResultScore.scanTime * 0.4
    } else if (dontGradeEfficiency && !dontGradePixelShift) {
      /*Pixel Shift
      SNR
      Scan Time*/
      imageResultScore.combinedScore =
        imageResultScore.pixelShift * 0.3 + imageResultScore.snr * 0.3 + imageResultScore.scanTime * 0.4
    } else if (dontGradeEfficiency && dontGradePixelShift) {
      /*SNR
      Scan Time*/
      imageResultScore.combinedScore = imageResultScore.snr * 0.4 + imageResultScore.scanTime * 0.6
    }

    imageResultScore.combinedScore = _.round(imageResultScore.combinedScore, 2)
    imageResultScore.groupScoreVariables = scores.groupScoreVariables
    imageResultScore.rubric = scores.rubric

    return imageResultScore
  },

  allFactorsIgnored() {
    return {
      factors: {
        angle: {
          ignore: true,
        },
        averages: {
          ignore: true,
        },
        inplaneRotationAngle: {
          ignore: true,
        },
        spacing: {
          ignore: true,
        },
        thickness: {
          ignore: true,
        },
        dimensionX: {
          ignore: true,
        },
        dimensionY: {
          ignore: true,
        },
        phaseVoxelSize: {
          ignore: true,
        },
        frequencyVoxelSize: {
          ignore: true,
        },
        coverageX: {
          ignore: true,
        },
        coverageY: {
          ignore: true,
        },
        coverageZ: {
          ignore: true,
        },
        singleSliceCoverageZ: {
          ignore: true,
        },
        sequenceType: {
          ignore: true,
        },
        inversionRecovery: {
          ignore: true,
        },
        inversionTime: {
          ignore: true,
        },
        fatSuppression: {
          ignore: true,
        },
        echoTime: {
          ignore: true,
        },
        repetitionTime: {
          ignore: true,
        },
        flipAngle: {
          ignore: true,
        },
        average: {
          ignore: true,
        },
        concatenations: {
          ignore: true,
        },
        frequencyMatrix: {
          ignore: true,
        },
        phaseMatrix: {
          ignore: true,
        },
        partialFourier: {
          ignore: true,
        },
        receiverBandWidth: {
          ignore: true,
        },
        parallelFactor: {
          ignore: true,
        },
        scanTime: {
          ignore: true,
        },
        snr: {
          ignore: true,
        },
        pixelShift: {
          ignore: true,
        },
        trEfficiency: {
          ignore: true,
        },
        bValueLower: {
          ignore: true,
        },
        bValueUpper: {
          ignore: true,
        },
        numBValues: {
          ignore: true,
        },
      },
    }
  },
}

module.exports = SliceQuantGradingUltraLabUtil
