const _ = require('lodash')
const { calculateGroupScoreVariables } = require('../api_util/score')
const { serializeSliceViews } = require('../api_util/api_util')

const PatientPrepUtil = {
  async calculateScores(prepScores) {
    const output = { scores: [] }
    for (let i = 0; i < prepScores.length; i++) {
      console.log('ready to calculate score for patient prep ' + i)
      //const score = prepScores[i]
      output.scores.push(
        await this.calculatePrepScore(
          prepScores[i].answer,
          prepScores[i].selectedAnswer,
          prepScores[i].attributes,
          prepScores[i].hasContrast,
          prepScores[i].isContrastOnly
        )
      )
    }

    output.combinedScore = _.meanBy(output.scores, 'combinedScore')
    return output
  },

  async calculatePrepScore(answer, selectedAnswer, attributes, hasContrast, isContrastOnly = false) {
    const landmarking = this.landmarkingScore(answer, selectedAnswer, attributes)
    const injectors = this.injectorsScore(answer, selectedAnswer, attributes, hasContrast, isContrastOnly)
    const positioning = this.positioningScore(answer, selectedAnswer, attributes)
    const combinedScore = this.calculateCombinedScore(landmarking, injectors, positioning, hasContrast, isContrastOnly)

    return {
      landmarking,
      injectors,
      positioning,
      answer,
      selectedAnswer,
      attributes,
      hasContrast,
      isContrastOnly,
      combinedScore,
      answerViews: await serializeSliceViews(answer.answerViews),
    }
  },

  landmarkingScore(answer, selectedAnswer, attributes) {
    const ap = this.landmarkingAPScore(answer, selectedAnswer, attributes)
    const si = this.landmarkingSIScore(answer, selectedAnswer, attributes)
    const combinedScore = ap.score * 0.5 + si.score * 0.5

    return { ap, si, combinedScore }
  },
  landmarkingAPScore(answer, selectedAnswer, attributes) {
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      landmarkDistanceAP: {
        ignore: false,
      },
    }

    const score = this.calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes)

    return {
      analysis: score.groupScoreVariables[0].analysis,
      rubric: score.rubric.factors.landmarkDistanceAP,
      score: 100 - score.groupScoreVariables[0].analysis[0].scoreLoss,
    }
  },

  landmarkingSIScore(answer, selectedAnswer, attributes) {
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      landmarkDistanceSI: {
        ignore: false,
      },
    }

    const score = this.calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes)

    return {
      analysis: score.groupScoreVariables[0].analysis,
      rubric: score.rubric.factors.landmarkDistanceSI,
      score: 100 - score.groupScoreVariables[0].analysis[0].scoreLoss,
    }
  },

  injectorsScore(answer, selectedAnswer, attributes, hasContrast, isContrastOnly) {
    let output = {}
    if (!hasContrast) {
      output = { saline: {}, contrast: {} }
    } else {
      const contrast = this.contrastScore(answer, selectedAnswer, attributes)

      if (isContrastOnly) {
        output = { contrast, saline: {}, combinedScore: contrast.score }
      } else {
        const saline = this.salineScore(answer, selectedAnswer, attributes)
        output = { saline, contrast, combinedScore: contrast.score * 0.75 + saline.score * 0.25 }
      }
    }
    return output
  },

  salineScore(answer, selectedAnswer, attributes) {
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      injectionSalineValue: {
        ignore: false,
      },
    }

    const score = this.calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes)
    return {
      analysis: score.groupScoreVariables[0].analysis,
      rubric: score.rubric.factors.injectionSalineValue,
      score: 100 - score.groupScoreVariables[0].analysis[0].scoreLoss,
    }
  },

  contrastScore(answer, selectedAnswer, attributes) {
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      injectionContrastValue: {
        ignore: false,
      },
    }

    const score = this.calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes)
    return {
      analysis: score.groupScoreVariables[0].analysis,
      rubric: score.rubric.factors.injectionContrastValue,
      score: 100 - score.groupScoreVariables[0].analysis[0].scoreLoss,
    }
  },

  positioningScore(answer, selectedAnswer, attributes) {
    const overrides = this.allFactorsIgnored()
    overrides.factors = {
      ...overrides.factors,
      isScanPositionRight: {
        ignore: false,
      },
    }

    const score = this.calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes)
    return {
      analysis: score.groupScoreVariables[0].analysis,
      rubric: score.rubric.factors.isScanPositionRight,
      score: 100 - score.groupScoreVariables[0].analysis[0].scoreLoss,
      answer: selectedAnswer,
      groupScoreVariables: score.groupScoreVariables,
    }
  },

  calculateGroupScoreVars(answer, selectedAnswer, overrides, attributes) {
    return calculateGroupScoreVariables(
      answer.variables,
      selectedAnswer,
      {
        ignoreInPlaneRotation: true,
        isContrastLab: false,
        isResolutionLab: false,
        isCTLab: true,
        isReconQuestion: false,
        isAcqQuestion: false,
        questionType: -1,
        phaseNum: false,
        isCalculateScoreForPatientPrep: true,
      },
      overrides,
      attributes
    )
  },

  calculateCombinedScore(landmarking, injectors, positioning, hasContrast) {
    let score = 0
    if (hasContrast) {
      score = landmarking.combinedScore * 0.5 + injectors.combinedScore * 0.2 + positioning.score * 0.3
    } else {
      score = landmarking.combinedScore * 0.6 + positioning.score * 0.4
    }

    return score
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
      },
    }
  },
}

module.exports = PatientPrepUtil
