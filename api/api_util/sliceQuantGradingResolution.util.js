const _ = require('lodash')
const { calculateGroupScoreVariables } = require('../api_util/score')

const SliceQuantGradingResolutionUtil = {
  calculateScores(answer, selectedAnswer, modifiers, rubricOverride = undefined, attributes = null) {
    let scoreDetails = {}
    scoreDetails.parameterScore = this.parametersScore(answer, selectedAnswer, modifiers)
    scoreDetails.slicePrescriptionScore = this.slicePrescriptionScore(answer, selectedAnswer, modifiers)
    scoreDetails.combinedScore = _.round(
      scoreDetails.parameterScore.combinedScore * 0.4 + scoreDetails.slicePrescriptionScore.combinedScore * 0.6,
      2
    )

    //console.log('++++++++++++++++++++++++++++++ Slice Quant score ++++++++++++++++++++++')
    return scoreDetails
  },

  parametersScore(answer, selectedAnswer, modifiers) {
    //console.log('++++++++++++++++++++++++++++++ Parameters score ++++++++++++++++++++++')
    const inversionRecovery = selectedAnswer['0_min'].inversionRecovery
    const sequenceType = selectedAnswer['0_min'].sequenceType
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
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
          precision: 1,
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
          precision: 1,
        },
      },
    }

    const scores = this.calculateGroupScoreVars(answer, selectedAnswer, modifiers, overrides)
    const paramsScore = {}
    scores.groupScoreVariables[0].analysis.forEach((x) => {
      paramsScore[x.factorName] = _.round(100 - x.scoreLoss, 2)
    })

    let combinedLoss = 0
    combinedLoss = (100 - paramsScore.phaseVoxelSize) * 0.5 + (100 - paramsScore.frequencyVoxelSize) * 0.5

    combinedLoss = _.round(100 - combinedLoss, 2)

    paramsScore.combinedScore = _.max([0, combinedLoss])
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
        noiseFactor: {
          ignore: true,
        },
        pixelShift: {
          ignore: true,
        },
        trEfficiency: {
          ignore: true,
        },
      },
    }
  },
}

module.exports = SliceQuantGradingResolutionUtil
