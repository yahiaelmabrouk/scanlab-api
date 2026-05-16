const { calculateGroupScoreVariables } = require('../api_util/score')
const _ = require('lodash')

const SliceQuantGradingCTUtil = {
  calculateScores(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    //console.log('++++++++++++++++++++++++++++++ Slice Quant score ++++++++++++++++++++++')
    let scoreDetails
    if (modifiers.isReconQuestion) {
      scoreDetails = this.reconQuestionScore(answer, selectedAnswer, modifiers, rubricOverride, attributes)
    } else if (modifiers.isAcqQuestion) {
      scoreDetails = this.acquisitionQuestionScore(answer, selectedAnswer, modifiers, rubricOverride, attributes)
    }
    console.log('======================end quant grading===================')
    //console.log(scoreDetails)
    return scoreDetails
  },

  reconQuestionScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    // console.log('+++++++++++++++++++++++++++++ Recon score ++++++++++++++++++++++')
    // recon slice prescription score
    const slicePrescriptionScore = this.reconSlicePrescriptionScore(
      answer,
      selectedAnswer,
      modifiers,
      rubricOverride,
      attributes
    )
    // console.log('======================slicePrescriptionScore===================')
    // console.log(slicePrescriptionScore)
    // recon parameter score
    const parameterScore = this.reconParameterScore(answer, selectedAnswer, modifiers, rubricOverride, attributes)
    // console.log('======================parameterScore===================')
    // console.log(parameterScore)
    //Slice Prescription- 70%
    //Parameters- 30%
    let combinedScore = slicePrescriptionScore.combinedScore * 0.7 + parameterScore.combinedScore * 0.3
    combinedScore = _.round(combinedScore, 2)

    return { slicePrescriptionScore, parameterScore, combinedScore }
  },

  reconSlicePrescriptionScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    /*Slice Prescription- 70%
        Slice Coverage- 30%
        Field Of View – 10%
        Slice Thickness – 10%
        Interval- 10%
        Angulation- 50%*/

    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      coverageZ: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          quadraticBuffer: null,
          linearFactor: 1.5,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 0, // needs to be exponential
          quadraticBuffer: 0,
          quadraticFactor: 0.11,
          maximumPointLoss: 100,
        },
      },
      coverageX: {
        ignore: false,
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
          quadraticBuffer: null,
          maximumPointLoss: 100,
        },
      },
      coverageY: {
        ignore: false,
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
          quadraticBuffer: null,
          maximumPointLoss: 100,
        },
      },
      dimensionX: {
        directional: true,
        keyName: 'fov_1',
        ignore: false,
        scoringTooHigh: {
          quadraticBuffer: null,
          linearFactor: 0.5,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          quadraticBuffer: null,
          linearFactor: 0.5,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
      },
      dimensionY: {
        directional: true,
        keyName: 'fov_2',
        ignore: false,
        scoringTooHigh: {
          quadraticBuffer: null,
          linearFactor: 0.5,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          quadraticBuffer: null,
          linearFactor: 0.5,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
      },
      thickness: {
        ignore: false,
        directional: true,
        scoringTooHigh: {
          linearFactor: 0,
          quadraticBuffer: 0.5,
          quadraticFactor: 15,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 0,
          quadraticBuffer: 1,
          quadraticFactor: 8,
          maximumPointLoss: 100,
        },
      },
      spacing: {
        keyName: 'slice_interval',
        unit: 'mm',
        ignore: false,
        directional: true,
        scoringTooHigh: {
          multiLinearFactors: [{ linearFactor: 10, linearLimit: 2 }, { linearFactor: 40 }],
          multiLinearBuffer: 0,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          multiLinearFactors: [{ linearFactor: 10, linearLimit: 2 }, { linearFactor: 40 }],
          multiLinearBuffer: 0,
          maximumPointLoss: 100,
        },
      },
      angle: {
        ignore: false,
        scoring: {
          multiLinearFactors: [{ linearFactor: 2, linearLimit: 3 }, { linearFactor: 5 }],
          multiLinearBuffer: 2,
          maximumPointLoss: 100,
        },
      },
    }

    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides, attributes)
    const prescriptionScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      prescriptionScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    let combinedLoss = 0
    combinedLoss =
      (100 - prescriptionScore.angle) * 0.3 +
      (100 - prescriptionScore.thickness) * 0.3 +
      (100 - prescriptionScore.coverageZ) * 0.3 +
      (100 - prescriptionScore.coverageX) * 0.2 +
      (100 - prescriptionScore.coverageY) * 0.2 +
      (100 - prescriptionScore.dimensionX) * 0.2 +
      (100 - prescriptionScore.dimensionY) * 0.2 +
      (100 - prescriptionScore.spacing) * 0.3

    combinedLoss = _.round(combinedLoss, 2)

    prescriptionScore.combinedScore = _.max([0, 100 - combinedLoss, 0])
    prescriptionScore.groupScoreVariables = scores.groupScoreVariables
    prescriptionScore.rubric = scores.rubric

    return prescriptionScore
  },

  reconParameterScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    /*Parameters- 30%
        Window – 50%
        Kernal- 50%*/

    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      kernel: {
        ignore: false,
        unit: 'mm',
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      windowLevel: {
        unit: 'mm',
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      windowWidth: {
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
    }
    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides, attributes)
    const parameterScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      parameterScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    let combinedLoss = 0
    combinedLoss =
      (100 - parameterScore.kernel) * 0.5 +
      (100 - parameterScore.windowLevel) * 0.25 +
      (100 - parameterScore.windowWidth) * 0.25

    combinedLoss = _.round(combinedLoss, 2)

    parameterScore.combinedScore = _.max([0, 100 - combinedLoss, 0])
    parameterScore.groupScoreVariables = scores.groupScoreVariables
    parameterScore.rubric = scores.rubric
    return parameterScore
  },

  acquisitionQuestionScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    //  console.log('+++++++++++++++++++++++++++++ Acquisition score ++++++++++++++++++++++')
    // acquisition slice prescription score
    const slicePrescriptionScore = this.acquisitionSlicePrescriptionScore(
      answer,
      selectedAnswer,
      modifiers,
      rubricOverride,
      attributes
    )
    // console.log('======================slicePrescriptionScore===================')
    // console.log(slicePrescriptionScore)
    // acquisition parameter score
    const parameterScore = this.acquisitionParameterScore(answer, selectedAnswer, modifiers, rubricOverride, attributes)
    // console.log('======================parameterScore===================')
    // console.log(parameterScore)
    let combinedScore = slicePrescriptionScore.combinedScore * 0.5 + parameterScore.combinedScore * 0.5
    combinedScore = _.round(combinedScore, 2)

    return { slicePrescriptionScore, parameterScore, combinedScore }
  },

  acquisitionSlicePrescriptionScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    //Slice Prescription Rubric – 50%
    //  Slice Coverage- 65%
    //  Field Of View- 25%
    //  Slice Thickness- 10%
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      coverageZ: {
        directional: true,
        ignore: false,
        unit: 'mm',
        scoringTooHigh: {
          quadraticBuffer: null,
          linearFactor: 3,
          linearBuffer: 0,
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          linearFactor: 0,
          quadraticBuffer: 0,
          quadraticFactor: 0.11,
          maximumPointLoss: 100,
        },
      },
      coverageX: {
        ignore: false,
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
          maximumPointLoss: 100,
        },
      },
      coverageY: {
        ignore: false,
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
          maximumPointLoss: 100,
        },
      },
      dimensionX: {
        unit: 'mm',
        directional: true,
        ignore: false,
        scoringTooHigh: {
          multiLinearFactors: [{ linearFactor: 1, linearLimit: 10 }, { linearFactor: 2 }],
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          multiLinearFactors: [{ linearFactor: 1, linearLimit: 5 }, { linearFactor: 2 }],
          maximumPointLoss: 100,
        },
      },
      dimensionY: {
        unit: 'mm',
        ignore: false,
        directional: true,
        scoringTooHigh: {
          multiLinearFactors: [{ linearFactor: 1, linearLimit: 10 }, { linearFactor: 2 }],
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          multiLinearFactors: [{ linearFactor: 1, linearLimit: 5 }, { linearFactor: 2 }],
          maximumPointLoss: 100,
        },
      },
      thickness: {
        unit: 'mm',
        directional: true,
        ignore: false,
        scoringTooHigh: {
          multiLinearFactors: [{ linearFactor: 15, linearLimit: 1 }, { linearFactor: 25 }],
          maximumPointLoss: 100,
        },
        scoringTooLow: {
          multiLinearFactors: [{ linearFactor: 10, linearLimit: 1 }, { linearFactor: 20 }],
          maximumPointLoss: 100,
        },
        feedback: {
          precision: 2,
        },
      },
    }

    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides, attributes)
    const prescriptionScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      prescriptionScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    const endTooLateRawValue = this.getAnalysisRawValue(scores.groupScoreVariables[0].analysis, 'endTooLateSeconds')
    const startTooEarlyRawValue = this.getAnalysisRawValue(scores.groupScoreVariables[0].analysis, 'startTooEarlySeconds')

    let combinedLoss = 0

    if (
      (_.has(prescriptionScore, ['isPressInjectBeforePressScanButton']) &&
        _.get(prescriptionScore, ['isPressInjectBeforePressScanButton'], 100) == 0) ||
      (_.has(prescriptionScore, ['isContrastDurationGreaterThanScanDuration']) &&
        _.get(prescriptionScore, ['isContrastDurationGreaterThanScanDuration'], 100) == 0) ||
      (_.has(prescriptionScore, ['isContrastDurationLongerThanScanDurationLessThanFiveSeconds']) &&
        _.get(prescriptionScore, ['isContrastDurationLongerThanScanDurationLessThanFiveSeconds'], 100) == 0) ||
      (endTooLateRawValue !== null && endTooLateRawValue >= 5) ||
      (startTooEarlyRawValue !== null && startTooEarlyRawValue >= 3)
    ) {
      combinedLoss = 100
    } else {
      combinedLoss =
        (100 - prescriptionScore.coverageZ) * 1.0 +
        (100 - prescriptionScore.coverageX) * 0.2 +
        (100 - prescriptionScore.coverageY) * 0.2 +
        (100 - prescriptionScore.dimensionX) * 0.2 +
        (100 - prescriptionScore.dimensionY) * 0.2 +
        (100 - prescriptionScore.thickness) * 0.3
    }

    combinedLoss = _.round(combinedLoss, 2)

    prescriptionScore.combinedScore = _.max([0, 100 - combinedLoss, 0])
    prescriptionScore.groupScoreVariables = scores.groupScoreVariables
    prescriptionScore.rubric = scores.rubric
    return prescriptionScore
  },

  acquisitionParameterScore(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    const isContrastOnly = answer[0].testInjectionMode === 1
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      kernel: {
        ignore: false,
        type: 'string',
        unit: 'mm',
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      windowLevel: {
        unit: 'mm',
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      windowWidth: {
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      salineFlow: {
        unit: 'ml',
        ignore: !modifiers.isPostContrast,
        directional: false,
        scoring: {
          quadraticBuffer: null,
          linearBuffer: 0,
          linearFactor: 50,
          maximumPointLoss: 100,
        },
      },
      contrastFlow: {
        unit: 'ml',
        ignore: !modifiers.isPostContrast,
        directional: false,
        scoring: {
          quadraticBuffer: null,
          linearBuffer: 0,
          linearFactor: 50,
          maximumPointLoss: 100,
        },
      },
      delayTime: {
        unit: 's',
        ignore: !modifiers.isPostContrast,
        scoring: {
          linearFactor: 5,
          maximumPointLoss: 100,
        },
      },
      breathingInstruction: {
        keyName: 'breathing_instruction',
        type: 'string',
        ignore: false,
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      },
      scanDelay: {
        ignore: false,
      },
      isPressInjectBeforePressScanButton: {
        ignore: false,
      },
      isContrastDurationGreaterThanScanDuration: {
        ignore: false,
      },
      isContrastDurationLongerThanScanDurationLessThanFiveSeconds: {
        ignore: false,
      },
      startTooEarlySeconds: {
        ignore: false,
      },
      endTooLateSeconds: {
        ignore: false,
      },
      imageDurationShorterThanContrastDurationPercent: {
        ignore: false,
      },
    }

    // console.log('======================scores===================')
    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides, attributes)
    // console.log(scores.groupScoreVariables[0].analysis)
    const parameterScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      parameterScore[x.factorName] = 100 - x.scoreLoss
    })

    // On some case of CT, we ignore delayTime
    // Ex: Acq after timing decision. The timing decision select Bolus tracking
    if (!_.has(parameterScore, ['delayTime'])) {
      _.set(parameterScore, ['delayTime'], 100)
    }

    // Some factors can be ignored (not returned in analysis) depending on timing-decision logic.
    // Default them to 100 so downstream consumers (skills grading) don't see `undefined`.
    const ignoredToFullScore = [
      'isPressInjectBeforePressScanButton',
      'isContrastDurationGreaterThanScanDuration',
      'isContrastDurationLongerThanScanDurationLessThanFiveSeconds',
      'startTooEarlySeconds',
      'endTooLateSeconds',
      'imageDurationShorterThanContrastDurationPercent',
    ]
    ignoredToFullScore.forEach((key) => {
      if (!_.has(parameterScore, [key])) {
        _.set(parameterScore, [key], 100)
      }
    })

    const endTooLateRawValue = this.getAnalysisRawValue(scores.groupScoreVariables[0].analysis, 'endTooLateSeconds')
    const startTooEarlyRawValue = this.getAnalysisRawValue(scores.groupScoreVariables[0].analysis, 'startTooEarlySeconds')

    // console.log(parameterScore)
    let combinedLoss = 0
    if (
      (_.has(parameterScore, ['isPressInjectBeforePressScanButton']) &&
        _.get(parameterScore, ['isPressInjectBeforePressScanButton'], 100) == 0) ||
      (_.has(parameterScore, ['isContrastDurationGreaterThanScanDuration']) &&
        _.get(parameterScore, ['isContrastDurationGreaterThanScanDuration'], 100) == 0) ||
      (_.has(parameterScore, ['isContrastDurationLongerThanScanDurationLessThanFiveSeconds']) &&
        _.get(parameterScore, ['isContrastDurationLongerThanScanDurationLessThanFiveSeconds'], 100) == 0) ||
      (endTooLateRawValue !== null && endTooLateRawValue >= 5) ||
      (startTooEarlyRawValue !== null && startTooEarlyRawValue >= 3)
    ) {
      combinedLoss = 100
    } else {
      if (modifiers.isPostContrast) {
        if (isContrastOnly) {
          combinedLoss =
            (100 - parameterScore.kernel) * 0.2 +
            (100 - parameterScore.windowLevel) * 0.1 +
            (100 - parameterScore.windowWidth) * 0.1 +
            (100 - parameterScore.contrastFlow) * 0.5 +
            (100 - parameterScore.delayTime) * 0.5 +
            (100 - parameterScore.breathingInstruction) * 0.2
        } else {
          combinedLoss =
            (100 - parameterScore.kernel) * 0.2 +
            (100 - parameterScore.windowLevel) * 0.1 +
            (100 - parameterScore.windowWidth) * 0.1 +
            (100 - parameterScore.salineFlow) * 0.2 +
            (100 - parameterScore.contrastFlow) * 0.3 +
            (100 - parameterScore.delayTime) * 0.5 +
            (100 - parameterScore.breathingInstruction) * 0.2
        }
      } else {
        combinedLoss =
          (100 - parameterScore.kernel) * 0.5 +
          (100 - parameterScore.windowLevel) * 0.25 +
          (100 - parameterScore.windowWidth) * 0.25 +
          (100 - parameterScore.breathingInstruction) * 0.2
      }
    }

    if (_.has(parameterScore, ['startTooEarlySeconds'])) {
      combinedLoss += (100 - parameterScore.startTooEarlySeconds) * 0.1
    }
    if (_.has(parameterScore, ['endTooLateSeconds'])) {
      combinedLoss += (100 - parameterScore.endTooLateSeconds) * 0.1
    }
    // 10/13/2025 - For every % over 40%, the user will lose 5% off of the contrast duration score.
    if (_.has(parameterScore, ['imageDurationShorterThanContrastDurationPercent'])) {
      combinedLoss += 100 - parameterScore.imageDurationShorterThanContrastDurationPercent
    }

    combinedLoss = _.round(combinedLoss, 2)

    parameterScore.combinedScore = _.max([0, 100 - combinedLoss, 0])
    parameterScore.groupScoreVariables = scores.groupScoreVariables
    parameterScore.rubric = scores.rubric
    return parameterScore
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

  getAnalysisRawValue(analysis, factorName) {
    const item = analysis.find((x) => x.factorName === factorName)
    return item && item.isBad ? item.value : null
  },

  allFactorsIgnored() {
    return {
      factors: {
        angle: {
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
        windowLevel: {
          ignore: true,
        },
        windowWidth: {
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
        kernel: {
          ignore: true,
        },
        isScanPositionRight: {
          ignore: true,
        },
        landmarkDistanceRatio: {
          ignore: true,
        },
        landmarkDistanceAP: {
          ignore: true,
        },
        landmarkDistanceSI: {
          ignore: true,
        },
        injectionContrastValue: {
          ignore: true,
        },
        injectionSalineValue: {
          ignore: true,
        },
        breathingInstruction: {
          ignore: true,
        },
        salineFlow: {
          ignore: true,
        },
        contrastFlow: {
          ignore: true,
        },
        delayTime: {
          ignore: true,
        },
        scanDelay: {
          ignore: true,
        },
        isPressInjectBeforePressScanButton: {
          ignore: true,
        },
        isContrastDurationGreaterThanScanDuration: {
          ignore: true,
        },
        isContrastDurationLongerThanScanDurationLessThanFiveSeconds: {
          ignore: true,
        },
        startTooEarlySeconds: {
          ignore: true,
        },
        imageDurationShorterThanContrastDurationPercent: {
          ignore: true,
        },
        endTooLateSeconds: {
          ignore: true,
        },
      },
    }
  },
}

module.exports = SliceQuantGradingCTUtil
