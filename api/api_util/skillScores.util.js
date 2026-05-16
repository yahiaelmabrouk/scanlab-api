const _ = require('lodash')
const SkillsGradingUtil = {
  calculateOverallSkillScoresForExam(skillScores) {
    if (skillScores.every((score) => score == null)) return null

    const skillTotals = {}

    skillScores.forEach((q) => {
      for (const skill in q) {
        if (!skillTotals[skill]) {
          skillTotals[skill] = {
            skillName: q[skill].skillName,
            totalScore: 0,
            count: 0,
          }
        }
        skillTotals[skill].totalScore += q[skill].skillScore
        skillTotals[skill].count++
      }
    })

    const averageScores = {}
    for (const skill in skillTotals) {
      const averageScore = skillTotals[skill].totalScore / skillTotals[skill].count
      averageScores[skill] = {
        skillName: skillTotals[skill].skillName,
        skillScore: Math.round(averageScore * 100) / 100, // rounding to hundredths place
      }
    }

    return averageScores
  },
  calculateOverallSkillScoresForExamCT(skillScores, patientPrepScores, patientSafetyQuetion) {
    //console.log('skillScores', skillScores)
    //console.log('patientSafetyQuetion', patientSafetyQuetion)
    let patientSafety = {
      skillName: 'Patient Screening and Safety',
      skillScore: _.get(patientSafetyQuetion, 'score', 0),
    }

    let { patientPosScores, contrastVolumeScores, isContrastOnly } = this.reformatPatientPrepScores(patientPrepScores)
    //console.log('patientPrepReformatted', patientPosScores)
    //console.log('contrastVolumeScores', contrastVolumeScores)

    let patientPosScoresAvg = this.calculateOverallSkillScoresForExam(patientPosScores)
    //patientPosScoresAvg.componentScores = patientPrepReformatted

    let { updatedObjects, extractedValues } = this.extractParameter(skillScores, 'contrastInjector')
    let contrastInjector
    if (contrastVolumeScores) {
      contrastInjector = this.aggregateContrastSkills(extractedValues[0], contrastVolumeScores, isContrastOnly)
    }
    //console.log('updatedSkills', updatedObjects)
    //console.log('contrastInjector', extractedValues)

    let skillScoresAvg = this.calculateOverallSkillScoresForExam(updatedObjects)

    skillScoresAvg = {
      ...skillScoresAvg,
      ...patientPosScoresAvg,
      patientSafety,
    }
    if (contrastInjector) {
      skillScoresAvg = {
        ...skillScoresAvg,
        contrastInjector,
      }
    }

    //console.log('skillScoresAvg', skillScoresAvg)
    return skillScoresAvg
  },

  aggregateContrastSkills(extractedValues, contrastVolumeScores, isContrastOnly) {
    let contrastSkill = {}
    contrastSkill.skillName = 'Contrast and Injector Practices'
    if (isContrastOnly) {
      contrastSkill.skillScore =
        extractedValues.componentScores.delayTime * 0.34 +
        extractedValues.componentScores.contrastFlow * 0.33 +
        contrastVolumeScores.componentScores.contrastInjector.skillScore * 0.33
      contrastSkill.componentScores = {
        delayTime: {
          skillName: 'Delay Time',
          skillScore: extractedValues.componentScores.delayTime,
        },
        contrastFlow: {
          skillName: 'Contrast Flow',
          skillScore: extractedValues.componentScores.contrastFlow,
        },
        contrastVolume: {
          skillName: 'Contrast Volume',
          skillScore: contrastVolumeScores.componentScores.contrastInjector.skillScore,
        },
      }
    } else {
      contrastSkill.skillScore =
        extractedValues.componentScores.delayTime * 0.2 +
        extractedValues.componentScores.contrastFlow * 0.2 +
        extractedValues.componentScores.salineFlow * 0.2 +
        contrastVolumeScores.componentScores.contrastInjector.skillScore * 0.2 +
        contrastVolumeScores.componentScores.salineInjector.skillScore * 0.2
      contrastSkill.componentScores = {
        delayTime: {
          skillName: 'Delay Time',
          skillScore: extractedValues.componentScores.delayTime,
        },
        contrastFlow: {
          skillName: 'Contrast Flow',
          skillScore: extractedValues.componentScores.contrastFlow,
        },
        salineFlow: {
          skillName: 'Saline Flow',
          skillScore: extractedValues.componentScores.salineFlow,
        },
        contrastVolume: {
          skillName: 'Contrast Volume',
          skillScore: contrastVolumeScores.componentScores.contrastInjector.skillScore,
        },
        salineVolume: {
          skillName: 'Saline Volume',
          skillScore: contrastVolumeScores.componentScores.salineInjector.skillScore,
        },
      }
    }

    return contrastSkill
  },

  reformatPatientPrepScores(patientPrepScores) {
    if (!patientPrepScores) return { patientPosScores: [], contrastVolumeScores: null, isContrastOnly: false }

    const patientPosScores = []
    let contrastVolumeScores
    let isContrastOnly
    for (let prepScore of patientPrepScores.scores) {
      let prepSkills = {}
      let patientPosAndInt = this.getPatientPositioningAndInteractions(prepScore)
      prepSkills.patientPosAndInt = patientPosAndInt

      if (prepScore.hasContrast) {
        contrastVolumeScores = this.getContrastInjectorPractices(prepScore, prepScore.isContrastOnly)
        isContrastOnly = prepScore.isContrastOnly
      }
      patientPosScores.push(prepSkills)
    }

    return { patientPosScores, contrastVolumeScores, isContrastOnly }
  },

  getPatientPositioningAndInteractions(score) {
    const patientPosAndInter = {}
    patientPosAndInter.skillName = 'Patient Positioning and Interactions'

    patientPosAndInter.skillScore =
      score.positioning.score * 0.34 + score.landmarking.si.score * 0.33 + score.landmarking.ap.score * 0.33

    patientPosAndInter.componentScores = {
      patientPositioning: {
        skillName: 'Patient Positioning Selection',
        skillScore: score.positioning.score,
      },
      landmarkingSI: {
        skillName: 'S/I Landmarking',
        skillScore: score.landmarking.si.score,
      },
      landmarkingAP: {
        skillName: 'A/P Landmarking',
        skillScore: score.landmarking.ap.score,
      },
    }

    return patientPosAndInter
  },
  getContrastInjectorPractices(score, isContrastOnly) {
    const contrastInjector = {}
    contrastInjector.skillName = 'Contrast Volumes'
    if (isContrastOnly) {
      contrastInjector.skillScore = score.injectors.contrast.score
      contrastInjector.componentScores = {
        contrastInjector: {
          skillName: 'Contrast Volume',
          skillScore: score.injectors.contrast.score,
        },
      }
    } else {
      contrastInjector.skillScore = score.injectors.contrast.score * 0.5 + score.injectors.saline.score * 0.5
      contrastInjector.componentScores = {
        contrastInjector: {
          skillName: 'Contrast Volume',
          skillScore: score.injectors.contrast.score * 0.5 + score.injectors.saline.score * 0.5,
        },
        salineInjector: {
          skillName: 'Saline Volume',
          skillScore: score.injectors.saline.score,
        },
      }
    }

    return contrastInjector
  },

  extractParameter(objects, parameterToExtract) {
    const extractedValues = []
    const updatedObjects = objects.map((obj) => {
      const newObj = { ...obj }
      if (parameterToExtract in newObj) {
        extractedValues.push(newObj[parameterToExtract])
        delete newObj[parameterToExtract]
      }
      return newObj
    })

    return { updatedObjects, extractedValues }
  },
}

module.exports = SkillsGradingUtil
