const SkillsScoresMRBasicUtil = {
  calculateScores(sliceQuantScore) {
    //console.log('===============skills grading calculate scores========================')
    //console.log(sliceQuantScore.slicePrescription.sliceGroups)
    const sliceGroups = sliceQuantScore.slicePrescription.sliceGroups
    const skillsGrading = {
      thicknessSpacing: this.calculateThicknessSpacing(sliceGroups),
      phaseFrequencyEncoding: this.calculatePhaseFrequencyEncoding(sliceGroups),
      angulation: this.calculateAngulation(sliceGroups),
      coverage: this.calculateCoverage(sliceGroups),
      fieldOfView: this.calculateFieldOfView(sliceGroups),
    }
    //console.log(skillsGrading)
    return skillsGrading
  },
  calculateThicknessSpacing(sliceGroups) {
    // The spacing checks are necessary because the spacing can be null (single slice mode)
    let thicknessTotal = 0
    let thicknessNum = 0
    let spacingTotal = 0
    let spacingNum = 0
    for (let sliceGroup of sliceGroups) {
      if (sliceGroup.scores.thickness != null) {
        thicknessTotal += sliceGroup.scores.thickness
        thicknessNum++
      }
      if (sliceGroup.scores.spacing != null) {
        spacingTotal += sliceGroup.scores.spacing
        spacingNum++
      }
    }
    let output
    if (spacingNum == 0) {
      output = {
        skillName: 'Thickness/ Spacing',
        componentScores: {
          sliceThickness: thicknessTotal / thicknessNum,
        },
        skillScore: thicknessTotal / thicknessNum,
      }
    } else {
      output = {
        skillName: 'Thickness/ Spacing',
        componentScores: {
          sliceThickness: thicknessTotal / thicknessNum,
          sliceGap: spacingTotal / spacingNum,
        },
        skillScore: (thicknessTotal / thicknessNum) * 0.5 + (spacingTotal / spacingNum) * 0.5,
      }
    }
    return output
  },
  calculatePhaseFrequencyEncoding(sliceGroups) {
    let rotationAngleTotal = 0
    for (let sliceGroup of sliceGroups) {
      rotationAngleTotal += sliceGroup.scores.inplaneRotationAngle
    }
    let output = {
      skillName: 'Phase/ Frequency Encoding',
      componentScores: {
        inplaneRotationAngle: rotationAngleTotal / sliceGroups.length,
      },
      skillScore: rotationAngleTotal / sliceGroups.length,
    }
    return output
  },
  calculateAngulation(sliceGroups) {
    let angleTotal = 0
    for (let sliceGroup of sliceGroups) {
      angleTotal += sliceGroup.scores.angle
    }
    let output = {
      skillName: 'Angulation',
      componentScores: {
        angle: angleTotal / sliceGroups.length,
      },
      skillScore: angleTotal / sliceGroups.length,
    }
    return output
  },
  calculateCoverage(sliceGroups) {
    let sliceCoverageTotal = 0
    let phaseCoverageTotal = 0
    let frequencyCoverageTotal = 0
    for (let sliceGroup of sliceGroups) {
      sliceCoverageTotal += sliceGroup.scores.coverageZ
      phaseCoverageTotal += sliceGroup.scores.coverageX
      frequencyCoverageTotal += sliceGroup.scores.coverageY
    }
    let output = {
      skillName: 'Coverage',
      componentScores: {
        sliceCoverage: sliceCoverageTotal / sliceGroups.length,
        phaseCoverage: phaseCoverageTotal / sliceGroups.length,
        frequencyCoverage: frequencyCoverageTotal / sliceGroups.length,
      },
      skillScore:
        (sliceCoverageTotal / sliceGroups.length) * 0.4 +
        (phaseCoverageTotal / sliceGroups.length) * 0.3 +
        (frequencyCoverageTotal / sliceGroups.length) * 0.3,
    }
    return output
  },
  calculateFieldOfView(sliceGroups) {
    let dimensionXTotal = 0
    let dimensionYTotal = 0
    for (let sliceGroup of sliceGroups) {
      dimensionXTotal += sliceGroup.scores.dimensionX
      dimensionYTotal += sliceGroup.scores.dimensionY
    }
    let output = {
      skillName: 'Field of View',
      componentScores: {
        dimensionX: dimensionXTotal / sliceGroups.length,
        dimensionY: dimensionYTotal / sliceGroups.length,
      },
      skillScore: (dimensionXTotal / sliceGroups.length) * 0.5 + (dimensionYTotal / sliceGroups.length) * 0.5,
    }
    return output
  },
}

module.exports = SkillsScoresMRBasicUtil
