const THREE = require('three')
const _ = require('lodash')
const { INJECTION_MODE, INJECT_CONDITION } = require('../../util/constants')

const SELECTION_IDENT_TYPES = ['min', 'max', 'proposed']

/**
 * Single-threaded stack-based Vector3 pool.
 *
 * Node.js executes JS on a single thread, so purely-synchronous scoring
 * functions can safely share a global pool without locks.  Each call site
 * saves a checkpoint before it starts allocating, then releases back to
 * that checkpoint when it is done — all pooled vectors are instantly
 * available for the next call, with zero GC pressure.
 *
 * Use:
 *   const mark = _v3Pool.checkpoint()
 *   const v = _v3Pool.acquire(x, y, z)
 *   ... use v ...
 *   _v3Pool.release(mark)   // returns v (and anything else acquired since mark) to the pool
 */
class Vector3Pool {
  constructor(initialSize = 64) {
    this._pool = []
    for (let i = 0; i < initialSize; i++) {
      this._pool.push(new THREE.Vector3())
    }
    this._top = 0
  }

  /** Acquire a pre-allocated Vector3, initialised to (x, y, z). */
  acquire(x = 0, y = 0, z = 0) {
    if (this._top >= this._pool.length) {
      // Pool exhausted — grow it (rare; only happens on very wide rubrics)
      this._pool.push(new THREE.Vector3())
    }
    const v = this._pool[this._top++]
    v.set(x, y, z)
    return v
  }

  /** Return the current stack top so all vectors acquired after this point
   *  can be bulk-released in O(1) via release(). */
  checkpoint() {
    return this._top
  }

  /** Release all vectors acquired since `mark` back to the pool. */
  release(mark) {
    this._top = mark
  }
}

const _v3Pool = new Vector3Pool(64)

const factorDefaults =
  // Factor Defaults
  {
    // translation key
    keyName: '',

    // primitive type
    type: 'number',

    // dimensional analysis unit
    unit: '',

    // if number has a less than / greater than component
    directional: false,

    // disregard this factor in scoring and feedback
    ignore: false,

    scoring: {
      // cap to total possible points that can be lost
      maximumPointLoss: null,

      // how much you must be off by to start losing score
      linearBuffer: 0,

      // linearFactor * amountWrong = scoreLoss
      // for boolean type factors, this IS the amount lost
      linearFactor: 0,

      // how much you must be off by to start losing score quadratically
      quadraticBuffer: 0,

      // quadraticFactor * (amountWrong ** 2) = scoreLoss
      quadraticFactor: 0,

      // for multi-linear scaling, this should be an array of {linearFactor, linearLimit}
      // linearFactor is the same as above
      // linearLimit is the maximum units to be graded at the associated linearFactor, then the next limit (if exist) will kick in
      //multiLinearFactors: null,

      // how much you must be off by to start losing score
      //multiLinearBuffer: 0

      /**
       * Calculate the total points loss based on degrees off with dynamic deductions and buffer.
       * Points are interpolated between given degree thresholds, with a buffer threshold.
       *
       * @param {number} degreesOff - The degree of error in the exam.
       * @param {Array} deductionRules - A list of arrays with [degree_threshold, points_deducted] in ascending order.
       */
      linearInterpolationFactor: null,
      linearInterpolationBuffer: 0,
    },

    // Same as scoring, used for directional values
    scoringTooLow: {},
    scoringTooHigh: {},

    feedback: {
      // ranges of score loss in terms of color
      // before first is green
      // between first and second is yellow
      // before third is red
      colorBreakPoints: [16, 31],

      // Useful for when the user doesn't need to be praised for something obvious
      onlyShowWhenWrong: false,

      // How many decimal places to show when rounding for display
      precision: 0,
    },
  }

function addFactorDefaults(factor) {
  if (factor.directional && !factor.scoringTooLow) {
    factor.scoringTooLow = factor.scoring
  }
  if (factor.directional && !factor.scoringTooHigh) {
    factor.scoringTooHigh = factor.scoring
  }
  return _.defaultsDeep(factor, factorDefaults)
}

function defaultRubric() {
  return {
    factors: {
      angle: addFactorDefaults({
        keyName: 'angle',
        unit: '°',
        scoring: {
          linearBuffer: 2,
          linearFactor: 2,
          quadraticBuffer: 10,
          quadraticFactor: 0.8,
        },
      }),
      inplaneRotationAngle: addFactorDefaults({
        keyName: 'in_plane_rotation',
        unit: '°',
        scoring: {
          linearBuffer: 15,
          linearFactor: 1.5,
          maximumPointLoss: 50,
        },
      }),
      spacing: addFactorDefaults({
        keyName: 'slice_gap',
        unit: 'mm',
        directional: true,
        scoringTooHigh: {
          linearFactor: 20,
          quadraticBuffer: 0.2,
          quadraticFactor: 8,
          maximumPointLoss: 20,
        },
        scoringTooLow: {
          linearFactor: 15,
          quadraticBuffer: 0.5,
          quadraticFactor: 10,
          maximumPointLoss: 20,
        },
      }),
      thickness: addFactorDefaults({
        keyName: 'slice_thickness',
        unit: 'mm',
        directional: true,
        scoringTooHigh: {
          linearFactor: 15,
          quadraticBuffer: 0.5,
          quadraticFactor: 15,
          maximumPointLoss: 20,
        },
        scoringTooLow: {
          linearFactor: 10,
          quadraticBuffer: 1,
          quadraticFactor: 8,
          maximumPointLoss: 20,
        },
      }),
      dimensionX: addFactorDefaults({
        keyName: 'phase_fov',
        unit: 'mm',
        scoring: {
          linearFactor: 0.5,
        },
      }),
      dimensionY: addFactorDefaults({
        keyName: 'frequency_fov',
        unit: 'mm',
        scoring: {
          linearFactor: 0.5,
        },
      }),
      phaseVoxelSize: addFactorDefaults({
        keyName: 'phase_voxel',
        unit: 'mm',
        directional: true,
        ignore: true,
        scoringTooHigh: {
          linearFactor: 50,
        },
        scoringTooLow: {
          linearFactor: 50,
        },
        feedback: {
          precision: 1,
        },
      }),
      frequencyVoxelSize: addFactorDefaults({
        keyName: 'frequency_voxel',
        unit: 'mm',
        directional: true,
        ignore: true,
        scoringTooHigh: {
          linearFactor: 50,
        },
        scoringTooLow: {
          linearFactor: 50,
        },
        feedback: {
          precision: 1,
        },
      }),
      coverageX: addFactorDefaults({
        keyName: 'phase_coverage',
        unit: 'mm',
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
        },
      }),
      coverageY: addFactorDefaults({
        keyName: 'frequency_coverage',
        unit: 'mm',
        scoring: {
          linearBuffer: 3,
          linearFactor: 0.5,
        },
      }),
      coverageZ: addFactorDefaults({
        keyName: 'slice_coverage',
        directional: true,
        unit: 'mm',
        scoringTooHigh: {
          linearFactor: 1.5,
        },
        scoringTooLow: {
          linearFactor: 1.5,
        },
      }),
      singleSliceCoverageZ: addFactorDefaults({
        keyName: 'slice_coverage',
        unit: 'mm',
        ignore: true,
        scoring: {
          linearFactor: 1.5,
        },
      }),
      // kernel: addFactorDefaults({
      //   keyName: 'kernel',
      //   unit: 'mm',
      //   ignore: true,
      //   scoring: {
      //     linearFactor: 1.5,
      //   },
      // }),
      windowLevel: addFactorDefaults({
        keyName: 'window_level',
        unit: 'mm',
        ignore: true,
        scoring: {
          linearFactor: 1.5,
          maximumPointLoss: 10,
        },
      }),
      windowWidth: addFactorDefaults({
        keyName: 'window_width',
        unit: 'mm',
        ignore: true,
        scoring: {
          linearFactor: 1.5,
          maximumPointLoss: 10,
        },
      }),
    },
    points: 100,
  }
}

/**
 * Recursively freezes an object and all of its nested properties so that
 * no call-site can accidentally mutate the cached default rubric.
 */
function _deepFreeze(obj) {
  if (obj !== null && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.getOwnPropertyNames(obj).forEach((name) => _deepFreeze(obj[name]))
    Object.freeze(obj)
  }
  return obj
}

/**
 * The default rubric is built *once* at module-load time and then
 * deep-frozen.  buildRubric() always _.cloneDeep()s this cached copy so
 * that:
 *  • every scoring call gets a fresh, fully-mutable rubric, AND
 *  • no scoring call (or test submission) can ever corrupt the template.
 *
 * This eliminates the ~20 addFactorDefaults / _.defaultsDeep calls that
 * were happening on every single scoring request.
 */
const _cachedDefaultRubric = _deepFreeze(defaultRubric())

// Patient prep
function buildCTLabFactors(isForPatientPrep = false) {
  return {
    factors: {
      isScanPositionRight: addFactorDefaults({
        keyName: 'scan_position',
        type: 'boolean',
        scoring: {
          linearFactor: isForPatientPrep ? 100 : 0,
        },
      }),
      // From 0 to 1: no minus score
      // From 1 to 2: 1 minus 0.15
      // Over 2: minus 10
      // One unit represents 33%
      landmarkDistanceRatio: addFactorDefaults({
        keyName: 'scan_landmark',
        unit: 'cm',
        type: 'number',
        directional: true,
        scoring: {
          linearFactor: isForPatientPrep ? 1 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
      }),
      landmarkDistanceAP: addFactorDefaults({
        keyName: 'scan_landmark_ap',
        unit: 'cm',
        type: 'number',
        directional: true,
        scoringTooHigh: {
          linearFactor: isForPatientPrep ? 10 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
        scoringTooLow: {
          linearFactor: isForPatientPrep ? 10 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
      }),
      landmarkDistanceSI: addFactorDefaults({
        keyName: 'scan_landmark_si',
        unit: 'cm',
        type: 'number',
        directional: true,
        scoringTooHigh: {
          linearFactor: isForPatientPrep ? 10 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
        scoringTooLow: {
          linearFactor: isForPatientPrep ? 10 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
      }),
      injectionContrastValue: addFactorDefaults({
        keyName: 'injection_contrast',
        unit: 'mm',
        type: 'number',
        directional: true,
        scoringTooHigh: {
          linearFactor: isForPatientPrep ? 1 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
        scoringTooLow: {
          linearFactor: isForPatientPrep ? 1 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
      }),
      injectionSalineValue: addFactorDefaults({
        keyName: 'injection_saline',
        unit: 'mm',
        type: 'number',
        directional: true,
        scoringTooHigh: {
          linearFactor: isForPatientPrep ? 0.5 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
        scoringTooLow: {
          linearFactor: isForPatientPrep ? 0.5 : 0,
          maximumPointLoss: isForPatientPrep ? 100 : 0,
        },
      }),
      breathingInstruction: addFactorDefaults({
        keyName: 'breathing_instruction',
        type: 'string',
        scoring: {
          linearFactor: 20,
        },
      }),
      // timeDifferenceFromCorrectTime: addFactorDefaults({
      //   keyName: 'time_difference_from_correct_time',
      //   type: 'number',
      //   unit: 's',
      //   directional: true,
      //   scoring: {
      //     linearFactor: 5,
      //   },
      // }),
    },
  }
}

function buildContrastLabFactors(sequenceType, inversionRecovery) {
  const isSE = sequenceType === 'SE'
  const isSEIR = isSE && inversionRecovery
  const isGRE = sequenceType === 'GRE'

  return {
    factors: {
      sequenceType: addFactorDefaults({
        keyName: 'sequence_type',
        type: 'boolean',
        scoring: {
          linearFactor: 50,
        },
      }),
      inversionRecovery: addFactorDefaults({
        keyName: 'inversion_recovery',
        type: 'boolean',
        scoring: {
          linearFactor: 25,
        },
        feedback: {
          // if the exam is not looking for IR to be enabled,
          // you aren't given a pat on the head for not enabling it
          onlyShowWhenWrong: !isSEIR,
        },
      }),
      inversionTime: addFactorDefaults({
        keyName: 'inversion_time',
        unit: 'ms',
        ignore: !isSEIR,
        directional: true,
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      fatSuppression: addFactorDefaults({
        keyName: 'fat_suppression',
        type: 'boolean',
        ignore: isSEIR,
        scoring: {
          linearFactor: 25,
        },
      }),
      echoTime: addFactorDefaults({
        keyName: 'echo_time',
        unit: 'ms',
        directional: true,
        scoring: {
          linearFactor: 0.4,
          maximumPointLoss: 20,
        },
      }),
      repetitionTime: addFactorDefaults({
        keyName: 'repetition_time',
        unit: 'ms',
        directional: true,
        scoring: {
          linearFactor: 0.2,
          maximumPointLoss: 20,
        },
      }),
      flipAngle: addFactorDefaults({
        keyName: 'flip_angle',
        unit: '°',
        directional: true,
        ignore: !isGRE,
        scoring: {
          linearFactor: 1,
          maximumPointLoss: 20,
        },
      }),
    },
  }
}

function buildUltraLabFactors() {
  return {
    factors: {
      averages: addFactorDefaults({
        keyName: 'averages',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      concatenations: addFactorDefaults({
        keyName: 'concatenations',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      frequencyMatrix: addFactorDefaults({
        keyName: 'frequency_matrix',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      phaseMatrix: addFactorDefaults({
        keyName: 'phase_matrix',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      partialFourier: addFactorDefaults({
        keyName: 'partial_fourier',
        type: 'string',
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 20,
        },
      }),
      receiverBandWidth: addFactorDefaults({
        keyName: 'receiver_bandwidth',
        type: 'number',
        scoring: {
          linearFactor: 1,
          maximumPointLoss: 20,
        },
      }),
      parallelFactor: addFactorDefaults({
        keyName: 'parallel_factor',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      scanTime: addFactorDefaults({
        keyName: 'scan_time',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      snr: addFactorDefaults({
        keyName: 'snr',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      pixelShift: addFactorDefaults({
        keyName: 'pixel_shift',
        type: 'number',
        scoring: {
          linearFactor: 0.02,
          maximumPointLoss: 20,
        },
      }),
      trEfficiency: addFactorDefaults({
        keyName: 'tr_efficiency',
        type: 'number',
        unit: '%',
        scoring: {
          linearFactor: 1,
          maximumPointLoss: 100,
        },
      }),
      bValueLower: addFactorDefaults({
        keyName: 'b_value_lower',
        type: 'number',
        unit: 'number',
        directional: true,
        scoring: {
          relativeScaleBase: 100,
          relativeScaleFactor: 10,
          maximumPointLoss: 100,
        },
      }),
      bValueUpper: addFactorDefaults({
        keyName: 'b_value_upper',
        type: 'number',
        unit: 'number',
        directional: true,
        scoring: {
          relativeScaleBase: 100,
          relativeScaleFactor: 7,
          maximumPointLoss: 100,
        },
      }),
      numBValues: addFactorDefaults({
        keyName: 'num_b_values',
        type: 'number',
        scoring: {
          linearFactor: 100,
          maximumPointLoss: 100,
        },
      }),
    },
  }
}

function buildRubric(overrides = [], isIgnoreAllFactors = false) {
  // Clone the frozen cached default rubric — O(clone) instead of O(20 × defaultsDeep)
  const newRubric = _.cloneDeep(_cachedDefaultRubric)
  overrides.forEach((override) => {
    if (override.factors) {
      for (const key in override.factors) {
        const baseFactor = newRubric.factors[key]
        if (!baseFactor) {
          newRubric.factors[key] = override.factors[key]
        } else {
          _.merge(baseFactor, override.factors[key])
        }
      }
    }
  })
  if (isIgnoreAllFactors) {
    for (const key in newRubric.factors) {
      const factor = newRubric.factors[key]
      factor.ignore = true
    }
  }
  return newRubric
}

// Just go by the sign of them / roughly same direction (good if we know it's either facing one way or exactly the other only)
function areVectorsSameDirSigns(a3, b3) {
  return _.every(['x', 'y', 'z'], function (axis) {
    return Math.sign(a3[axis]) === Math.sign(b3[axis])
  })
}

// Selection A is supposed to be inside B; this gets how much that's not the case on axis3
// // Assuming Selections/boxes are axis-aligned to each other (because the math seems to get crazy otherwise)
// //  this should be pretty close, if it isn't, we already ding for being off on the angle
// // dirByAxis = {x: xDirection3, y: yDirection3, z: zDirection3}
// Returns how much A is outside of B per axis: {x: 0, y: 3.4, z: 5.6} (no less than 0)
function getSelectionOutsideAmountByAxis(dirByAxis, aCenter3, aDimension3, bCenter3, bDimension3) {
  // Pool-checkpoint: all vectors acquired inside this function are released
  // before the function returns; wrongAmountByAxis contains only numbers.
  const _mark = _v3Pool.checkpoint()

  // get diff3 between two box's center3s - we don't care where they are in space, just related to each other
  const diffCenterWorld3 = _v3Pool.acquire()
  diffCenterWorld3.copy(aCenter3).sub(bCenter3)

  let wrongAmountByAxis = _.mapValues(dirByAxis, function (dirAxis, axis) {
    // project world diff3 onto current axis
    const tmp3Projection = _v3Pool.acquire()
    tmp3Projection.copy(diffCenterWorld3).projectOnVector(dirByAxis[axis])

    // This is the correct center difference, but we lost direction (regained below)
    let projectedLength = tmp3Projection.length()

    // dividing the projected (onto dir3) Vector by its length should give us either the dir3 or the opposite
    //   use this to figure out the scalar direction
    const dir3Diff = _v3Pool.acquire()
    if (projectedLength !== 0) {
      dir3Diff.copy(tmp3Projection).divideScalar(projectedLength)
    }
    let direction = areVectorsSameDirSigns(dir3Diff, dirByAxis[axis]) ? 1 : -1

    // B center compared to A center, with direction
    let diffCenterScalar = projectedLength * direction

    // X
    let aRadius = aDimension3[axis] * 0.5
    let bRadius = bDimension3[axis] * 0.5

    let offAmount = 0

    let aRight = aRadius
    let bRight = diffCenterScalar + bRadius
    let diffRight = aRight - bRight
    if (diffRight > 0) {
      offAmount += diffRight
    }

    let aLeft = -aRadius
    let bLeft = diffCenterScalar - bRadius
    let diffLeft = bLeft - aLeft
    if (diffLeft > 0) {
      offAmount += diffLeft
    }
    // console.log('diffRight',diffRight, 'diffLeft', diffLeft, 'offAmount', offAmount)
    return offAmount
  })

  _v3Pool.release(_mark)
  return wrongAmountByAxis
}

// how much is center3 outside of where it should be (the Max) in the zAxis?
function getSingleSliceWrongAmountZCenter3(zAxis3, proposedCenter3, answerMax) {
  const _mark = _v3Pool.checkpoint()

  // diff proposed center3 from max center3 in world space
  const diffCenterWorld3 = _v3Pool.acquire()
  diffCenterWorld3.copy(proposedCenter3).sub(answerMax.center3)

  // project that diff onto our zAxis, so now we have the vec3 of difference in just tha axis
  const diffProjected3 = _v3Pool.acquire()
  diffProjected3.copy(diffCenterWorld3).projectOnVector(zAxis3)

  // get length of that difference (0 would be spot on) - we lose the sign, but it shouldn't matter since being too far away/long in either direction is equally bad
  const projectedLength = diffProjected3.length()

  // the max length that difference is allowed to be is half the dimension3.z (the height)
  const maxRadius = answerMax.dimensions3.z * 0.5

  _v3Pool.release(_mark)
  return Math.max(0, projectedLength - maxRadius)
}

// Assuming Selections/boxes are axis-aligned to each other (because the math seems to get crazy otherwise)
//  this should be pretty close, if it isn't, we already ding for being off on the angle
// dirByAxis = {x: xDirection3, y: yDirection3, z: zDirection3}
function getSelectionAIsInsideB(dirByAxis, aCenter3, aDimension3, bCenter3, bDimension3) {
  let wrongAmountByAxis = getSelectionOutsideAmountByAxis(dirByAxis, aCenter3, aDimension3, bCenter3, bDimension3)
  return wrongAmountByAxis
}

function vectorizeAnswerData(answer) {
  // Acquire all Vector3s from the pool — the caller is responsible for
  // releasing the pool back to its checkpoint after these vectors are
  // no longer needed (see calculateScoreVariables / getInPlaneRotationDifference).
  const xDir = _v3Pool.acquire(answer.xDirectionX, answer.xDirectionY, answer.xDirectionZ)
  const yDir = _v3Pool.acquire(answer.yDirectionX, answer.yDirectionY, answer.yDirectionZ)
  const center = _v3Pool.acquire(answer.centerX, answer.centerY, answer.centerZ)
  const dimensions = _v3Pool.acquire(answer.dimensionX, answer.dimensionY, answer.dimensionZ)

  let newVal = _.assign({}, answer, {
    xDirection3: xDir,
    yDirection3: yDir,
    center3: center,
    dimensions3: dimensions,
  })

  //In CTLab mode, user can stop the slice presentation and cut slices
  // ctAnswerCenter is the center of the rest of slices
  if (_.has(answer, ['ctAnswerCenterX']) && _.has(answer, ['ctAnswerCenterY']) && _.has(answer, ['ctAnswerCenterZ'])) {
    _.assign(newVal, {
      ctAnswerCenter3: _v3Pool.acquire(answer.ctAnswerCenterX, answer.ctAnswerCenterY, answer.ctAnswerCenterZ),
    })
  }
  if (
    _.has(answer, ['ctAnswerDimensionX']) &&
    _.has(answer, ['ctAnswerDimensionY']) &&
    _.has(answer, ['ctAnswerDimensionZ'])
  ) {
    _.assign(newVal, {
      ctAnswerDimension3: _v3Pool.acquire(
        answer.ctAnswerDimensionX,
        answer.ctAnswerDimensionY,
        answer.ctAnswerDimensionZ
      ),
    })
  }

  // Compute zDirection = xDirection × yDirection using a pooled scratch vector
  // (avoids the .clone() that was allocating a new heap object on every call)
  const zDir = _v3Pool.acquire(xDir.x, xDir.y, xDir.z)
  zDir.cross(yDir)

  return _.assign(newVal, {
    zDirection3: zDir,
  })
}

function identToGroupId(ident) {
  return _.parseInt(_.first(_.split(ident, '_')))
}

// Based on code from frontend
function getGroupsFromIdentsArray(identsArray) {
  let groupsById = {}
  _.each(identsArray, function (propKey) {
    // it's one of the valid identTypes (and not like answer id/name), there will be multiple per group
    if (
      _.some(SELECTION_IDENT_TYPES, (identType) => propKey.endsWith(identType) && propKey.length > identType.length)
    ) {
      let groupId = identToGroupId(propKey)
      groupsById[groupId] = identToGroupId(propKey)
    }
  })

  let index = -1
  let groups = _.map(groupsById, function (groupId) {
    // Group Name is based on index (not groupId), because we show the user a nice 1...N, whereas groupIDs may fragment over time ([5, 6, 9] can happen, etc)
    index++
    return { id: groupId, index, name: index + 1 + '' }
  })
  return _.sortBy(groups, 'id')
}

// augment groups to have min/max answerConfigs
function getGroupsFromCorrectAnswer(answerCorrect) {
  let groups = getGroupsFromIdentsArray(_.keys(answerCorrect))
  return _.map(groups, function (group) {
    return Object.assign(group, {
      min: answerCorrect[`${group.id}_min`],
      max: answerCorrect[`${group.id}_max`],
    })
  })
}

function distanceSqrtBetweenTwoCenterAnswerConfigs(answerConfig1, answerConfig2) {
  let x1 = answerConfig1.centerX
  let y1 = answerConfig1.centerY
  let z1 = answerConfig1.centerZ
  let x2 = answerConfig2.centerX
  let y2 = answerConfig2.centerY
  let z2 = answerConfig2.centerZ
  return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
}

// The scoreVariables are too detailed, and the frontend should generally not get them
function serializeGroupScoreVariables(groupScoreVariables) {
  return _.map(groupScoreVariables, function (data) {
    // TODO: is this supposed to be "omit"
    // "omit" uses an array of strings which are supposed to be key names
    // "omitBy" uses a function which is applied to each value in an object
    return _.omitBy(data, 'scoreVariables')
  })
}

/**
 *
 * @param {*} answerCorrect
 * @param { {ignoreInPlaneRotation:boolean; isContrastLab: boolean; isResolutionLab: boolean; isCTLab: boolean; isReconQuestion: boolean; isAcqQuestion: boolean; isPostContrast: boolean; phaseNum: number; isCalculateScoreForPatientPrep: boolean; questionType: number;} } modifiers
 * @param {*} rubricOverride
 * @returns
 */
function getRubric(answerCorrect, modifiers, rubricOverride = undefined) {
  const {
    ignoreInPlaneRotation,
    isContrastLab,
    isResolutionLab,
    isUltraLab,
    isCTLab,
    isReconQuestion,
    questionType,
    isAcqQuestion,
    isPostContrast,
    isProduction,
  } = modifiers
  const isTimingDecisionQuestion = questionType == 5
  const rubricOverrides = []

  rubricOverrides.push({
    factors: {
      kernel: addFactorDefaults({
        keyName: 'kernel',
        type: 'string',
        unit: 'mm',
        ignore: !isCTLab,
        scoring: {
          linearFactor: 1.5,
        },
      }),
    },
  })

  if (isCTLab) {
    rubricOverrides.push({
      factors: {
        windowLevel: {
          ignore: false,
        },
        windowWidth: {
          ignore: false,
        },
        inplaneRotationAngle: {
          ignore: true,
        },
      },
    })
  }

  if (isContrastLab) {
    rubricOverrides.push(
      buildContrastLabFactors(answerCorrect['0_min'].sequenceType, answerCorrect['0_min'].inversionRecovery)
    )
  }

  if (isAcqQuestion && isPostContrast) {
    rubricOverrides.push({
      factors: {
        salineFlow: addFactorDefaults({
          keyName: 'saline_flow',
          unit: 'ml',
          ignore: !isCTLab,
          scoring: {
            linearFactor: 1,
          },
        }),
      },
    })
    rubricOverrides.push({
      factors: {
        contrastFlow: addFactorDefaults({
          keyName: 'contrast_flow',
          unit: 'ml',
          ignore: !isCTLab,
          scoring: {
            linearFactor: 1,
          },
        }),
      },
    })
    rubricOverrides.push({
      factors: {
        delayTime: addFactorDefaults({
          keyName: 'delay_time',
          unit: 's',
          ignore: !isCTLab,
          scoring: {
            linearFactor: 1,
          },
        }),
      },
    })
  }

  // Mark is zero if it's false
  if (isAcqQuestion) {
    rubricOverrides.push({
      factors: {
        isPressInjectBeforePressScanButton: addFactorDefaults({
          keyName: 'is_press_inject_before_press_scan_button',
          unit: '',
          ignore: !isCTLab,
          type: 'boolean',
          scoring: {
            linearFactor: 100,
            maximumPointLoss: 100,
          },
        }),
        isContrastDurationGreaterThanScanDuration: addFactorDefaults({
          keyName: 'is_contrast_duration_greater_than_scan_duration',
          unit: '',
          ignore: !isCTLab,
          type: 'boolean',
          scoring: {
            linearFactor: 100,
            maximumPointLoss: 100,
          },
        }),
        imageDurationShorterThanContrastDurationPercent: addFactorDefaults({
          keyName: 'image_duration_shorter_than_contrast_duration_percent',
          analysisValueKey: 'imageDurationShorterThanContrastDurationSeconds',
          unit: '%',
          ignore: !isCTLab,
          directional: true,
          type: 'number',
          scoringTooHigh: {
            linearFactor: 5,
            maximumPointLoss: 100,
          },
          scoringTooLow: {
            linearFactor: 0,
            maximumPointLoss: 100,
          },
          feedback: {
            precision: 1,
          },
        }),
        startTooEarlySeconds: addFactorDefaults({
          keyName: 'start_too_early_seconds',
          unit: 's',
          ignore: !isCTLab,
          directional: true,
          scoringTooHigh: {
            linearFactor: 33.33,
            maximumPointLoss: 100,
          },
          scoringTooLow: {
            linearFactor: 33.33,
            maximumPointLoss: 100,
          },
        }),
        endTooLateSeconds: addFactorDefaults({
          keyName: 'end_too_late_seconds',
          unit: 's',
          ignore: !isCTLab,
          directional: true,
          scoringTooHigh: {
            linearFactor: 20,
            maximumPointLoss: 100,
          },
          scoringTooLow: {
            linearFactor: 20,
            maximumPointLoss: 100,
          },
        }),
        // Disabled per product owner's request
        //  see
        // Comment on 09/11/2025
        // isContrastDurationLongerThanScanDurationLessThanFiveSeconds: addFactorDefaults({
        //   keyName: 'is_contrast_duration_longer_than_scan_duration_less_than_five_seconds',
        //   unit: '',
        //   ignore: !isCTLab,
        //   type: 'boolean',
        //   scoring: {
        //     linearFactor: 100,
        //     maximumPointLoss: 100,
        //   },
        // }),
        scanDelay: addFactorDefaults({
          keyName: 'contrast_delay_time',
          unit: 's',
          ignore: !isCTLab,
          scoring: {
            linearFactor: 5,
            maximumPointLoss: 100,
          },
        }),
      },
    })
  }

  if (isResolutionLab) {
    rubricOverrides.push({
      factors: {
        phaseVoxelSize: {
          ignore: false,
        },
        frequencyVoxelSize: {
          ignore: false,
        },
      },
    })
  }

  if (ignoreInPlaneRotation) {
    rubricOverrides.push({
      factors: {
        inplaneRotation: {
          ignore: true,
        },
      },
    })
  }

  if (answerCorrect.isSingleSlice) {
    // add single slice factors
    rubricOverrides.push({
      factors: {
        spacing: {
          ignore: true,
        },
        angle: {
          scoring: {
            linearBuffer: answerCorrect.maxRotationOff,
          },
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
          ignore: false,
        },
      },
    })
  }

  if (isAcqQuestion) {
    rubricOverrides.push({
      factors: {
        spacing: {
          ignore: true,
        },
      },
    })
  }

  if (!isReconQuestion && isCTLab) {
    rubricOverrides.push({
      factors: {
        angle: {
          ignore: true,
        },
      },
    })
  }

  if (isCTLab) {
    rubricOverrides.push(buildCTLabFactors(_.get(modifiers, ['isCalculateScoreForPatientPrep'], false)))
  }

  if ((isReconQuestion || isTimingDecisionQuestion) && isCTLab) {
    rubricOverrides.push({
      factors: {
        breathingInstruction: {
          ignore: true,
        },
      },
    })
  }

  // if (!isTimingDecisionQuestion || !isCTLab || !isProduction) {
  //   rubricOverrides.push({
  //     factors: {
  //       timeDifferenceFromCorrectTime: {
  //         ignore: true,
  //       },
  //     },
  //   })
  // }
  // Rubric for satband
  if (!isCTLab && !isProduction) {
    rubricOverrides.push({
      factors: {
        // isSatBandIntersectWithSatBandMarkZone: addFactorDefaults({
        //   keyName: 'sat_band',
        //   type: 'boolean',
        //   scoring: {
        //     linearFactor: 10,
        //   },
        // }),
        intersectSatbandZoneDistance: addFactorDefaults({
          keyName: 'sat_band_zone',
          type: 'number',
          unit: 'mm',
          scoring: {
            linearFactor: 1,
            maximumPointLoss: 100,
          },
        }),
      },
    })
  }
  if (isUltraLab) {
    rubricOverrides.push(
      buildContrastLabFactors(answerCorrect['0_min'].sequenceType, answerCorrect['0_min'].inversionRecovery)
    )
    rubricOverrides.push(buildUltraLabFactors())
  }
  if (rubricOverride) {
    rubricOverrides.push(rubricOverride)
  }

  return buildRubric(rubricOverrides, isTimingDecisionQuestion)
}

function findBestWeightBasedDose(weight, weightBasedDoses) {
  if (!weightBasedDoses || weightBasedDoses.length === 0) {
    return null
  }

  // Find the closest dose to the weight
  return _.minBy(weightBasedDoses, (dose) => Math.abs(dose.weightMetric - weight))
}

/**
 *
 * @param {any[]} userAnswerConfigs supplied by user (one answerConfig per group, so just one most commonly)
 * @param {*} answerCorrect
 * @param { {ignoreInPlaneRotation:boolean; isContrastLab: boolean; isResolutionLab: boolean; isCTLab: boolean; isReconQuestion: boolean; isAcqQuestion: boolean; isPostContrast: boolean; phaseNum: number; questionType: number;} } modifiers
 * @param {*} rubricOverride
 * @returns
 */
function calculateGroupScoreVariables(
  userAnswerConfigs,
  answerCorrect,
  modifiers,
  rubricOverride = undefined,
  attributes = {}
) {
  const injectionAttribute = _.get(attributes, 'injectionAttribute', null)
  const weightBasedDoses = _.get(attributes, 'weightBasedDoses', null)
  let answersToCheck = [answerCorrect]
  if (_.size(answerCorrect.variants) > 0) {
    answersToCheck = answersToCheck.concat(answerCorrect.variants)
  }
  const bestVariant = _.minBy(answersToCheck, (correctAnswer) => {
    // Simple check to get the variant with the closest in-plane rotation
    // Not expecting this to be different among the groups
    // 0_min may not exist! First group could have ID 2, so the first group's min could be 2_min / etc
    let firstGroupId = _.get(getGroupsFromIdentsArray(_.keys(correctAnswer)), '0.id')
    return getInPlaneRotationDifference(userAnswerConfigs[0], correctAnswer[`${firstGroupId}_min`])
  })

  // calculateScoreVariables(answer.variables, selectedAnswer.min, selectedAnswer.max, stackQuestion.ignoreInPlaneRotation)
  let groupsCorrectAnswerRemaining = getGroupsFromCorrectAnswer(bestVariant)
  //console.log('calculateGroupScoreVariables', userAnswerConfigs,groupsCorrectAnswerRemaining)

  // TODO What if there aren't the same amount of each? Error...

  let rubricOverrideLocal = _.cloneDeep(rubricOverride)

  const testInjectionMode = _.get(userAnswerConfigs, ['0', 'testInjectionMode'], INJECTION_MODE.CONTRAST_AND_SALINE)

  if (testInjectionMode == INJECTION_MODE.CONTRAST_ONLY) {
    _.set(rubricOverrideLocal, ['factors', 'injectionSalineValue', 'ignore'], true)
    _.set(rubricOverrideLocal, ['factors', 'salineFlow', 'ignore'], true)
  }

  const isAcq = _.get(userAnswerConfigs, [0, 'isAcquisitionQuestion'], false)
  const testInjectCondition = _.get(userAnswerConfigs, [0, 'testInjectCondition'], INJECT_CONDITION.BOLUS_TRACKING)
  const screeningFormWeightMetric = _.get(userAnswerConfigs, [0, 'screeningFormWeightMetric'], 0)
  const isQuestionSetHasTimingDecisionQuestion = _.get(
    userAnswerConfigs,
    [0, 'isQuestionSetHasTimingDecisionQuestion'],
    false
  )
  const isTimingDecisionUseTestBolus = _.get(userAnswerConfigs, [0, 'isTimingDecisionUseTestBolus'], false)
  const isPrevStackQuestionIsTimingDecision = _.get(userAnswerConfigs, [0, 'isPrevStackQuestionIsTimingDecision'], true)
  const isContrastDurationGreaterThanScanDuration = _.get(
    userAnswerConfigs,
    [0, 'isContrastDurationGreaterThanScanDuration'],
    true
  )
  const isContrastDurationLongerThanScanDurationLessThanFiveSeconds = _.get(
    userAnswerConfigs,
    [0, 'isContrastDurationLongerThanScanDurationLessThanFiveSeconds'],
    true
  )
  const isTimingDecisionUseSetDelay = _.get(userAnswerConfigs, [0, 'isTimingDecisionUseSetDelay'], false)
  const isPressInjectBeforePressScanButton = _.get(userAnswerConfigs, [0, 'isPressInjectBeforePressScanButton'], false)
  if (modifiers.isCTLab) {
    if (
      !isQuestionSetHasTimingDecisionQuestion ||
      !_.has(userAnswerConfigs, [0, 'isPressInjectBeforePressScanButton']) ||
      (isAcq && (isTimingDecisionUseSetDelay || isPressInjectBeforePressScanButton))
    ) {
      _.set(rubricOverrideLocal, ['factors', 'isPressInjectBeforePressScanButton', 'ignore'], true)
    }
    // if (!_.has(userAnswerConfigs, [0, 'timeDifferenceFromCorrectTime'])) {
    //   _.set(rubricOverrideLocal, ['factors', 'timeDifferenceFromCorrectTime', 'ignore'], true)
    // }
    // Only grade this rubric when acq is after timing decision and the timing decision select bolus tracking
    if (
      !isQuestionSetHasTimingDecisionQuestion ||
      !_.has(userAnswerConfigs, [0, 'isContrastDurationGreaterThanScanDuration']) ||
      !isPrevStackQuestionIsTimingDecision ||
      (isAcq &&
        isPrevStackQuestionIsTimingDecision &&
        (isTimingDecisionUseSetDelay || isContrastDurationGreaterThanScanDuration))
    ) {
      _.set(rubricOverrideLocal, ['factors', 'isContrastDurationGreaterThanScanDuration', 'ignore'], true)
    }
    // Only grade this rubric when acq is after timing decision and the timing decision select bolus tracking
    if (
      !isQuestionSetHasTimingDecisionQuestion ||
      !_.has(userAnswerConfigs, [0, 'isContrastDurationLongerThanScanDurationLessThanFiveSeconds']) ||
      !isPrevStackQuestionIsTimingDecision ||
      (isAcq &&
        isPrevStackQuestionIsTimingDecision &&
        (isTimingDecisionUseSetDelay || isContrastDurationLongerThanScanDurationLessThanFiveSeconds))
    ) {
      _.set(
        rubricOverrideLocal,
        ['factors', 'isContrastDurationLongerThanScanDurationLessThanFiveSeconds', 'ignore'],
        true
      )
    }
    if (
      isAcq &&
      isQuestionSetHasTimingDecisionQuestion &&
      isPrevStackQuestionIsTimingDecision &&
      !isTimingDecisionUseSetDelay
    ) {
      _.set(rubricOverrideLocal, ['factors', 'delayTime', 'ignore'], true)
    }
    if (
      !isAcq ||
      !isQuestionSetHasTimingDecisionQuestion ||
      !isTimingDecisionUseTestBolus ||
      !isPrevStackQuestionIsTimingDecision
    ) {
      _.set(rubricOverrideLocal, ['factors', 'scanDelay', 'ignore'], true)
    }
    if (!_.has(userAnswerConfigs, [0, 'endTooLateSeconds'])) {
      _.set(rubricOverrideLocal, ['factors', 'startTooEarlySeconds', 'ignore'], true)
    }
    if (!_.has(userAnswerConfigs, [0, 'endTooLateSeconds'])) {
      _.set(rubricOverrideLocal, ['factors', 'endTooLateSeconds', 'ignore'], true)
    }
    if (!_.has(userAnswerConfigs, [0, 'imageDurationShorterThanContrastDurationPercent'])) {
      _.set(rubricOverrideLocal, ['factors', 'imageDurationShorterThanContrastDurationPercent', 'ignore'], true)
    }
  } else {
    const satBands = _.get(userAnswerConfigs, ['0', 'satBands'], [])
    if (_.get(satBands, 'length', 0) == 0) {
      _.set(rubricOverrideLocal, ['factors', 'isSatBandIntersectWithSatBandMarkZone', 'ignore'], true)
      _.set(rubricOverrideLocal, ['factors', 'intersectSatbandZoneDistance', 'ignore'], true)
    }
  }
  const rubric = getRubric(answerCorrect, modifiers, rubricOverrideLocal)

  // For each user provided guess (answer attempt), find the closet previously unmatched correct answer (based on distance from min's center3)
  let output = _.map(userAnswerConfigs, function (userAnswerConfig, userAnswerConfigIndex) {
    let closestCorrectAnswerGroup = _.minBy(groupsCorrectAnswerRemaining, function (correctAnswerGroup) {
      return distanceSqrtBetweenTwoCenterAnswerConfigs(correctAnswerGroup.min, userAnswerConfig)
    })
    // It's not longer eligible for further userAnswerConfigs
    groupsCorrectAnswerRemaining = _.without(groupsCorrectAnswerRemaining, closestCorrectAnswerGroup)

    const userFieldStrength = userAnswerConfig.fieldStrength
    if (
      (modifiers.isContrastLab || modifiers.isUltraLab) &&
      userFieldStrength &&
      bestVariant.fieldStrengthRanges &&
      bestVariant.fieldStrengthRanges[userFieldStrength]
    ) {
      const ftRanges = bestVariant.fieldStrengthRanges[`${userFieldStrength}`]
      if (ftRanges && ftRanges.min && ftRanges.max) {
        // Fix for initial data being saved as string
        // TODO a migration should be done to fix existing answers
        for (const key in ftRanges.min) {
          ftRanges.min[key] = _.toNumber(ftRanges.min[key])
          ftRanges.max[key] = _.toNumber(ftRanges.max[key])
        }
        Object.assign(closestCorrectAnswerGroup.min, ftRanges.min)
        Object.assign(closestCorrectAnswerGroup.max, ftRanges.max)
      }
    }

    // Handle minSeqTe override for DIFF sequences in UltraLab
    if (modifiers.isUltraLab) {
      const isDiffusion = closestCorrectAnswerGroup.min.specialtyOption === 'Diffusion'
      const hasMinSeqTe = isDiffusion && userAnswerConfig.minSeqTe !== undefined

      if (hasMinSeqTe) {
        // Override echoTime targets for proximity-based grading
        closestCorrectAnswerGroup.min.echoTime = userAnswerConfig.minSeqTe
        closestCorrectAnswerGroup.max.echoTime = userAnswerConfig.minSeqTe
      }
    }

    if (modifiers?.questionType == 5 && modifiers?.isCTLab) {
      Object.assign(closestCorrectAnswerGroup.min, {
        timeDifferenceFromCorrectTime: 0,
      })
      Object.assign(closestCorrectAnswerGroup.max, {
        timeDifferenceFromCorrectTime: 0,
      })
    }

    Object.assign(closestCorrectAnswerGroup.min, {
      startTooEarlySeconds: 0,
      endTooLateSeconds: 0,
      landmarkDistanceRatio: 0,
      landmarkDistanceAP: 0,
      landmarkDistanceSI: 0,
      imageDurationShorterThanContrastDurationPercent: 0,
      imageDurationShorterThanContrastDurationSeconds: 0,
    })
    Object.assign(closestCorrectAnswerGroup.max, {
      startTooEarlySeconds: 0,
      endTooLateSeconds: 0,
      landmarkDistanceRatio: 0,
      landmarkDistanceAP: 0,
      landmarkDistanceSI: 0,
      imageDurationShorterThanContrastDurationSeconds: 0,
      imageDurationShorterThanContrastDurationPercent: 40,
    })

    const bestWeightBasedDose = findBestWeightBasedDose(screeningFormWeightMetric, weightBasedDoses)
    if (modifiers.isAcqQuestion && modifiers.isPostContrast) {
      if (injectionAttribute) {
        const {
          salineMinFlowRate,
          salineMaxFlowRate,
          contrastMinFlowRate,
          contrastMaxFlowRate,
          posts,
          salineMinDose,
          salineMaxDose,
          contrastMinDose,
          contrastMaxDose,
        } = injectionAttribute

        const contrastMinDoseValue =
          !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
            ? contrastMinDose
            : bestWeightBasedDose?.contrastDose || 0

        const contrastMaxDoseValue =
          !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
            ? contrastMaxDose
            : bestWeightBasedDose?.contrastDose || 0

        // const contrastMinFlowRateValue =
        //   !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
        //     ? contrastMinFlowRate
        //     : bestWeightBasedDose?.rate || 0
        // const contrastMaxFlowRateValue =
        //   !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
        //     ? contrastMaxFlowRate
        //     : bestWeightBasedDose?.rate || 0

        const questionPhaseNum = _.get(modifiers, ['phaseNum'], 1)
        const injectionPost = _.get(posts, [questionPhaseNum - 1], { minTime: 0, maxTime: 0 })
        Object.assign(closestCorrectAnswerGroup.min, {
          salineFlow: salineMinFlowRate,
          contrastFlow: contrastMinFlowRate,
          delayTime: _.get(injectionPost, ['minTime'], 0),
          injectionContrastValue: contrastMinDoseValue,
          injectionSalineValue: salineMinDose,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
        Object.assign(closestCorrectAnswerGroup.max, {
          salineFlow: salineMaxFlowRate,
          contrastFlow: contrastMaxFlowRate,
          delayTime: _.get(injectionPost, ['maxTime'], 0),
          injectionContrastValue: contrastMaxDoseValue,
          injectionSalineValue: salineMaxDose,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
      } else {
        Object.assign(closestCorrectAnswerGroup.min, {
          salineFlow: 0,
          contrastFlow: 0,
          delayTime: 0,
          injectionContrastValue: 0,
          injectionSalineValue: 0,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
        Object.assign(closestCorrectAnswerGroup.max, {
          salineFlow: 0,
          contrastFlow: 0,
          delayTime: 0,
          injectionContrastValue: 0,
          injectionSalineValue: 0,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
      }
    } else {
      if (injectionAttribute) {
        const { salineMinDose, salineMaxDose, contrastMinDose, contrastMaxDose } = injectionAttribute
        const contrastMinDoseValue =
          !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
            ? contrastMinDose
            : bestWeightBasedDose?.contrastDose || 0

        const contrastMaxDoseValue =
          !testInjectCondition || testInjectCondition === INJECT_CONDITION.SET_VOLUME
            ? contrastMaxDose
            : bestWeightBasedDose?.contrastDose || 0
        Object.assign(closestCorrectAnswerGroup.min, {
          injectionContrastValue: contrastMinDoseValue,
          injectionSalineValue: salineMinDose,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
        Object.assign(closestCorrectAnswerGroup.max, {
          injectionContrastValue: contrastMaxDoseValue,
          injectionSalineValue: salineMaxDose,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
      } else {
        Object.assign(closestCorrectAnswerGroup.min, {
          injectionContrastValue: 0,
          injectionSalineValue: 0,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
        Object.assign(closestCorrectAnswerGroup.max, {
          injectionContrastValue: 0,
          injectionSalineValue: 0,
          landmarkDistanceRatio: 0,
          landmarkDistanceAP: 0,
          landmarkDistanceSI: 0,
        })
      }
    }

    if (
      isAcq &&
      isQuestionSetHasTimingDecisionQuestion &&
      isTimingDecisionUseTestBolus &&
      isPrevStackQuestionIsTimingDecision
    ) {
      const timingDecisionSecondsWithMaxBrightness = _.get(
        userAnswerConfig,
        ['timingDecisionSecondsWithMaxBrightness'],
        0
      )
      Object.assign(closestCorrectAnswerGroup.min, {
        scanDelay: timingDecisionSecondsWithMaxBrightness,
      })
      Object.assign(closestCorrectAnswerGroup.max, {
        scanDelay: timingDecisionSecondsWithMaxBrightness + 2,
      })
    }

    if (!modifiers.isCTLab) {
      Object.assign(closestCorrectAnswerGroup.min, {
        intersectSatbandZoneDistance: 0,
      })
      Object.assign(closestCorrectAnswerGroup.max, {
        intersectSatbandZoneDistance: 0,
      })
    }

    let scoreVariables = calculateScoreVariables(
      userAnswerConfig,
      closestCorrectAnswerGroup.min,
      closestCorrectAnswerGroup.max
    )
    let { score, analysis, trafficLights } = getScoreAndAnalysis(scoreVariables, rubric, closestCorrectAnswerGroup)

    return {
      groupId: closestCorrectAnswerGroup.id,
      userAnswerConfigIndex,
      scoreVariables,
      analysis,
      score,
      trafficLights,
    }
  })

  // Students would probably want to see the groups in their local order; but an admin probably doesn't care/know what that was, so would want to see in correctAnswer's group order
  //  Therefore, store this whole output, which has enough data for both cases (and just censor the scoreVariables)
  return {
    groupScoreVariables: output,
    score: flatScoreFromGroupScoreVariables(output),
    rubric,
  }
}

function flatScoreFromGroupScoreVariables(groupScoreVariables) {
  let sum = _.sumBy(groupScoreVariables, 'score')
  return _.round(sum / groupScoreVariables.length, 2)
}

function getInPlaneRotationDifference(answerData, correctData) {
  // Pool bracket: all vectors acquired inside this function are released before
  // the function returns; only a scalar number escapes.
  const _mark = _v3Pool.checkpoint()

  const answer = vectorizeAnswerData(answerData)
  const correctAnswer = vectorizeAnswerData(correctData)

  // INPLANE ROTATION
  const newSelectionX = _v3Pool.acquire()
  newSelectionX.copy(answer.xDirection3).projectOnPlane(correctAnswer.zDirection3)

  const newTarget = _v3Pool.acquire()
  newTarget.copy(correctAnswer.xDirection3).projectOnPlane(correctAnswer.zDirection3)

  const inplaneRotationAngleOff = THREE.Math.radToDeg(newTarget.angleTo(newSelectionX))

  _v3Pool.release(_mark)
  return Math.abs(Math.abs(inplaneRotationAngleOff - 90) - 90)
}

function calculateScoreVariables(answerData, minData, maxData) {
  // Pool bracket: every Vector3 acquired during this call (including those
  // created by vectorizeAnswerData and the geometry helpers) is released
  // back to the pool before we return.  outputVars contains only primitives
  // so no vector references escape; the pool state is fully restored.
  const _poolMark = _v3Pool.checkpoint()
  try {
    const answer = vectorizeAnswerData(answerData)
    const answerMin = vectorizeAnswerData(minData)
    const answerMax = vectorizeAnswerData(maxData)

    /// Full cuboid intersection: https://computergraphics.stackexchange.com/questions/7623/how-to-compute-volume-of-intersection-of-non-axis-aligned-cuboids-in-3d

    // CURRENT
    // 'center3', 'dimensions3', 'zDirection3', 'xDirection3'

    // ANSWER
    // centerX: (...)
    // centerY: (...)
    // centerZ: (...)
    // dimensionX: 100
    // dimensionY: 140
    // dimensionZ: 100
    // id: (...)
    // name: (...)
    // numberOfSlices: (...)
    // spacing: (...)
    // thickness: (...)
    // xDirectionX: 1
    // xDirectionY: 0
    // xDirectionZ: 0
    // yDirectionX: (...)
    // yDirectionY: (...)
    // yDirectionZ: (...)

    // Correct Answer Min
    // answerCurrentMin
    let outputVars = {}

    // outputVar name
    // figure out how much various values are offset from the Min/Max range
    // So NumberOfSlices attempt value 4 with a correct range of 10 to 20, would mean it's 6 (6 off from 10); whereas 24 would be off 4 (4 off from 20)
    // dimensionX = Phase, dimensionY = Frequency, dimensionZ = stack height
    let gradingParams = [
      'thickness',
      'spacing',
      'sequenceType',
      'echoTime',
      'repetitionTime',
      'inversionTime',
      'flipAngle',
      'fatSuppression',
      'inversionRecovery',
      'frequencyVoxelSize',
      'phaseVoxelSize',
      'scanTime',
      'snr',
      'pixelShift',
      'trEfficiency',
      'averages',
      'concatenations',
      'frequencyMatrix',
      'phaseMatrix',
      'partialFourier',
      'receiverBandWidth',
      'parallelFactor',
      'bValueLower',
      'bValueUpper',
      'numBValues',
      'landmarkDistanceRatio',
      'landmarkDistanceAP',
      'landmarkDistanceSI',
      'isScanPositionRight',
      'isSatBandIntersectWithSatBandMarkZone',
      'intersectSatbandZoneDistance',
      'injectionContrastValue',
      'injectionSalineValue',
      'kernel',
      'windowWidth',
      'windowLevel',
      'salineFlow',
      'contrastFlow',
      'delayTime',
      'scanDelay',
      'breathingInstruction',
      // 'timeDifferenceFromCorrectTime',
      'isPressInjectBeforePressScanButton',
      'isContrastDurationGreaterThanScanDuration',
      'isContrastDurationLongerThanScanDurationLessThanFiveSeconds',
      'startTooEarlySeconds',
      'imageDurationShorterThanContrastDurationPercent',
      'imageDurationShorterThanContrastDurationSeconds',
      'endTooLateSeconds',
    ]

    const addNonNumericGradingParameter = (baseVarName, attemptedValue, correctValue) => {
      if (
        [
          'isScanPositionRight',
          'isPressInjectBeforePressScanButton',
          'isContrastDurationGreaterThanScanDuration',
          'isContrastDurationLongerThanScanDurationLessThanFiveSeconds',
        ].includes(baseVarName)
      ) {
        correctValue = true
      }
      if (['isSatBandIntersectWithSatBandMarkZone'].includes(baseVarName)) {
        correctValue = false
      }
      outputVars[`${baseVarName}Is`] = attemptedValue
      if (correctValue !== attemptedValue) {
        outputVars[`${baseVarName}ShouldBe`] = correctValue
      }
    }

    const addLowHighGradingParameter = (baseVarName, lowValue, highValue) => {
      outputVars[`${baseVarName}TooHigh`] = _.round(highValue, 3)
      outputVars[`${baseVarName}TooLow`] = _.round(lowValue, 3)
      outputVars[`${baseVarName}Off`] = _.round(Math.max(lowValue, highValue), 3)
    }

    const addRangedGradingParameter = (baseVarName, attemptedValue, minValue, maxValue) => {
      // I've seen this not be in order in production, which is probably fine, but we need to handle the AnswerMin having the max of range, and vice versa
      //  so do this by sorting them
      // aka. AnswerMin's numberOfSlices can be smaller or greater (or same-as) than AnswerMax's; this is fine, but the range below needs to be [smaller,larger]
      let correctRange = _.sortBy([minValue, maxValue])
      let offsetTooHigh = Math.max(0, attemptedValue - correctRange[1])
      let offsetTooLow = Math.max(0, correctRange[0] - attemptedValue)
      outputVars[`${baseVarName}Is`] = attemptedValue
      addLowHighGradingParameter(baseVarName, offsetTooLow, offsetTooHigh)
    }

    const addNumericGradingParameter = (baseVarName, attemptedValue, maxOff) => {
      outputVars[`${baseVarName}Is`] = attemptedValue
      outputVars[`${baseVarName}Off`] = _.round(attemptedValue, 1)
      outputVars[`${baseVarName}OffMax`] = maxOff
    }

    _.each(gradingParams, function (baseVarName) {
      let answerVarPath = baseVarName
      let attemptedValue = _.get(answer, answerVarPath)
      let minValue = _.get(answerMin, answerVarPath)
      let maxValue = _.get(answerMax, answerVarPath)

      if (_.isNil(attemptedValue) || attemptedValue === '') {
        attemptedValue = 0
      }

      if (_.isNumber(attemptedValue)) {
        addRangedGradingParameter(baseVarName, attemptedValue, minValue, maxValue)
        //}
      } else {
        addNonNumericGradingParameter(baseVarName, attemptedValue, minValue)
      }
    })

    // Number of Slices Off
    // let numberOfSlicesOff = 0
    // if(answer.numberOfSlices < answerMin.numberOfSlices){
    //   numberOfSlicesOff = answerMin.numberOfSlices - answer.numberOfSlices
    // }else if(answer.numberOfSlices > answerMax.numberOfSlices){
    //   numberOfSlicesOff =  answer.numberOfSlices - answerMax.numberOfSlices
    // }

    // Z Axis is direction of the stack, which is what we care about (rotating the stack is fine)
    let angleOff = THREE.Math.radToDeg(answerMin.zDirection3.angleTo(answer.zDirection3))
    // Flipping the stack 180 degree (aka. PI) is a perfect answer also. Worst is being half-way off between that
    angleOff = Math.abs(Math.abs(angleOff - 90) - 90)

    // score should have one decimal place
    // - 10 points per 4 angle off past the first ~4 (the maxAngleOff), increased gradually
    // the most the angle can be off before losing score due to it (Customizable for isSingleSlice, otherwise 4)
    addNumericGradingParameter('angle', angleOff)

    const inplaneRotationAngleOff = getInPlaneRotationDifference(answerData, minData)
    addNumericGradingParameter('inplaneRotationAngle', inplaneRotationAngleOff)

    let dirByAxis = {
      x: answer.xDirection3,
      y: answer.yDirection3,
      z: answer.zDirection3,
    }

    let answerCenter3 = answer.center3
    if (_.has(answer, ['ctAnswerCenter3'])) {
      answerCenter3 = answer.ctAnswerCenter3
    }

    let answerDimension3 = answer.dimensions3
    if (_.has(answer, ['ctAnswerDimension3'])) {
      answerDimension3 = answer.ctAnswerDimension3
    }

    // Min box must be inside Proposed box
    let wrongCoverageMin = getSelectionAIsInsideB(
      dirByAxis,
      answerMin.center3,
      answerMin.dimensions3,
      answerCenter3,
      answerDimension3
    )

    // Proposed must be inside Max
    let wrongCoverageMax = getSelectionAIsInsideB(
      dirByAxis,
      answerCenter3,
      answerDimension3,
      answerMax.center3,
      answerMax.dimensions3
    )

    addRangedGradingParameter('dimensionX', answerDimension3.x, answerMin.dimensions3.x, answerMax.dimensions3.x)
    addRangedGradingParameter('dimensionY', answerDimension3.y, answerMin.dimensions3.y, answerMax.dimensions3.y)

    let wrongCoverageZ = getSingleSliceWrongAmountZCenter3(answer.zDirection3, answerCenter3, answerMax)
    addNumericGradingParameter('singleSliceCoverageZ', wrongCoverageZ)

    addNumericGradingParameter('coverageX', wrongCoverageMax.x + wrongCoverageMin.x)
    addNumericGradingParameter('coverageY', wrongCoverageMax.y + wrongCoverageMin.y)
    //addLowHighGradingParameter('coverageX', wrongCoverageMin.x, wrongCoverageMax.x)
    //addLowHighGradingParameter('coverageY', wrongCoverageMin.y, wrongCoverageMax.y)
    addLowHighGradingParameter('coverageZ', wrongCoverageMin.z, wrongCoverageMax.z)

    return outputVars
  } finally {
    _v3Pool.release(_poolMark)
  }
}

function applyScaling(
  lostPoints,
  {
    linearFactor,
    linearBuffer = 0,
    quadraticFactor,
    quadraticBuffer,
    multiLinearFactors = null,
    multiLinearBuffer = 0,
    linearInterpolationFactor = null,
    linearInterpolationBuffer = 0,
    relativeScaleFactor,
    relativeScaleBase = 100,
    relativeMidpoint,
    maximumPointLoss,
  }
) {
  if (!lostPoints) {
    return 0
  }

  let totalLoss = 0

  if (lostPoints > linearBuffer) {
    //console.log('linearBuffer', linearBuffer)
    //console.log('lostPoints', lostPoints)
    totalLoss += linearFactor * (lostPoints - linearBuffer)
  }

  if (_.isNumber(quadraticBuffer) && lostPoints > quadraticBuffer) {
    //console.log('quadraticBuffer', quadraticBuffer)
    //console.log('lostPoints', lostPoints)
    totalLoss += quadraticFactor * Math.pow(lostPoints - quadraticBuffer, 2)
  }

  if (_.isArray(multiLinearFactors)) {
    //console.log('multiLinearFactors', multiLinearFactors)
    //console.log('lostPoints', lostPoints)
    totalLoss = multiLinearFactorScaling(lostPoints, multiLinearFactors, multiLinearBuffer)
  }

  if (_.isArray(linearInterpolationFactor)) {
    //console.log('================linearInterpolationFactorScaling======================')
    totalLoss = linearInterpolationFactorScaling(lostPoints, linearInterpolationFactor, linearInterpolationBuffer)
  }

  if (_.isNumber(relativeScaleFactor)) {
    //console.log('=================relativeScalingFactor======================')
    totalLoss = relativeScalingFactor(lostPoints, relativeScaleFactor, relativeScaleBase, relativeMidpoint)
  }
  //console.log('totalLoss', totalLoss)
  if (_.isFinite(maximumPointLoss)) {
    return Math.min(maximumPointLoss, totalLoss)
  } else {
    return totalLoss
  }
}

/* Method will scale the grading base of the size of correct answers,
 * the larger the value of the correct value more leniency the grading will be */
function relativeScalingFactor(lostPoints, relativeScalingFactor, relativeScalingBase, relativeMidpoint) {
  const baseFactor = relativeMidpoint / relativeScalingBase
  const totalLoss = (lostPoints / baseFactor) * relativeScalingFactor
  return _.round(totalLoss, 2)
}

/* Method will change slope of linear scaling if it exceeds a certain threshold */
function multiLinearFactorScaling(lostPoints, multiLinearFactors, multiLinearBuffer = 0) {
  //console.log('=================multiLinearFactorScaling======================')
  let totalLoss = 0
  let accumulatedX = 0

  if (lostPoints > multiLinearBuffer) {
    let limit
    for (let i = 0; i < multiLinearFactors.length; i++) {
      const bufferedPoints = lostPoints - multiLinearBuffer
      const factor = multiLinearFactors[i].linearFactor
      if (multiLinearFactors[i].linearLimit) {
        limit = multiLinearFactors[i].linearLimit
      } else {
        limit = bufferedPoints
      }
      const points = bufferedPoints < limit ? bufferedPoints : limit
      totalLoss += factor * (points - accumulatedX)
      accumulatedX += points - accumulatedX
      if (bufferedPoints <= limit) break
    }
  }
  return totalLoss
}

function linearInterpolationFactorScaling(degreesOff, deductionRules, buffer = 0) {
  /**
   * Calculate the total points loss based on degrees off with dynamic deductions and buffer.
   * Points are interpolated between given degree thresholds, with a buffer threshold.
   *
   * @param {number} degreesOff - The degree of error in the exam.
   * @param {Array} deductionRules - A list of arrays with [degree_threshold, points_deducted] in ascending order.
   * @param {number} buffer - The buffer threshold; no points are deducted unless degreesOff exceeds this value.
   * @return {number} The total points loss, never less than 0.
   */

  // Apply the buffer: if degreesOff is within the buffer, return 0 loss
  if (degreesOff <= buffer) {
    return 0
  }

  // Adjust degreesOff by subtracting the buffer
  degreesOff -= buffer

  // Sort the deduction rules by degree threshold to ensure proper order
  deductionRules.sort((a, b) => a[0] - b[0])

  // Edge case: If degreesOff is less than the smallest threshold, deduct corresponding points
  if (degreesOff <= deductionRules[0][0]) {
    return Math.max(deductionRules[0][1], 0)
  }

  // Edge case: If degreesOff exceeds the largest threshold, deduct max points
  if (degreesOff >= deductionRules[deductionRules.length - 1][0]) {
    return Math.max(deductionRules[deductionRules.length - 1][1], 0)
  }

  // Find the two thresholds to interpolate between
  let pointsDeducted = 0
  for (let i = 0; i < deductionRules.length - 1; i++) {
    const [lowerThreshold, lowerPoints] = deductionRules[i]
    const [upperThreshold, upperPoints] = deductionRules[i + 1]

    // If degreesOff is between the current threshold pair
    if (lowerThreshold < degreesOff && degreesOff <= upperThreshold) {
      // Perform linear interpolation
      const proportion = (degreesOff - lowerThreshold) / (upperThreshold - lowerThreshold)
      pointsDeducted = lowerPoints + proportion * (upperPoints - lowerPoints)
      break
    }
  }
  // Return total loss (points deducted), ensure it's not less than 0
  return Math.max(pointsDeducted, 0)
}

function getScoreAndAnalysis(scoreVariables, rubric, closestCorrectAnswerGroup) {
  let score = 100
  let analysis = []
  let trafficLights = {}
  const exceptKeyNames = ['injection_contrast', 'injection_saline']

  function add(keyName, keyAdjective, value, scoreLoss, factorName) {
    const factor = rubric.factors[factorName]
    const isBad = keyAdjective !== 'correct'
    if (factor && factor.feedback && factor.feedback.onlyShowWhenWrong && !isBad) {
      return
    }
    score -= scoreLoss
    const fullKeyName = `TestResults.${keyName}_${keyAdjective}`
    let color = 'red'

    if (isBad) {
      if (scoreLoss < factor.feedback.colorBreakPoints[0]) {
        color = 'green'
      } else if (scoreLoss < factor.feedback.colorBreakPoints[1]) {
        color = 'yellow'
      }

      if (!_.isNumber(value)) {
        color = 'red'
      }
    } else {
      color = 'green'
    }

    const valueIsNumber = _.isNumber(value)
    let precision = _.get(factor, 'feedback.precision', 0)
    if (isBad && valueIsNumber && _.round(value || 0, precision) === 0) {
      // To prevent feedback like "off by 0mm"
      precision = 1
    }

    analysis.push({
      key: fullKeyName,
      keyName,
      value: valueIsNumber ? _.round(value || 0, precision) : value,
      isBad,
      scoreLoss,
      factorName,
      color,
      unit: factor.unit,
    })
  }

  // Feedback for Managers so they have a general idea of how well they will score
  function addTrafficLightColor(type, lightColor) {
    trafficLights[type] = lightColor
  }
  function addTrafficLightBoolean(type, isCorrect) {
    addTrafficLightColor(type, isCorrect ? 'green' : 'red')
  }
  function addTrafficLightFromScoreReduction(type, scoreReduction) {
    let lightColor = 'red'
    if (scoreReduction < 10) {
      lightColor = 'green'
    } else if (scoreReduction < 30) {
      lightColor = 'yellow'
    }
    addTrafficLightColor(type, lightColor)
  }

  _.forOwn(rubric.factors, (factor, factorName) => {
    if (!factor.ignore && factor.scoring) {
      const keyName = factor.keyName
      let keyAdjective = 'correct'
      let keyValue
      const varOff = scoreVariables[`${factorName}Off`]
      const varShouldBe = scoreVariables[`${factorName}ShouldBe`]
      const varTooLow = scoreVariables[`${factorName}TooLow`]
      const varTooHigh = scoreVariables[`${factorName}TooHigh`]
      const varIs = scoreVariables[`${factorName}Is`]

      const analysisValueKey = factor.analysisValueKey
      let analysisValue = null
      if (analysisValueKey) {
        analysisValue = scoreVariables[`${analysisValueKey}Is`]
      }
      // calculate score loss _.isString(
      let scoreLoss = 0
      //console.log('factor', factorName)
      if (factor.type === 'number') {
        if (factor.directional) {
          //console.log('====info', keyName, varTooLow, varTooHigh)
          if (_.isFinite(varTooLow) && varTooLow > 0) {
            const scoring = factor.scoringTooLow ? factor.scoringTooLow : factor.scoring
            if (_.isNumber(scoring.relativeScaleFactor)) {
              // if the grading is relative to the magnitude of the answer, we need to grab it
              let minValue = _.get(closestCorrectAnswerGroup.min, factorName)
              let maxValue = _.get(closestCorrectAnswerGroup.max, factorName)
              scoring.relativeMidpoint = (maxValue + minValue) / 2
            }
            scoreLoss = applyScaling(varTooLow, scoring)
            keyValue = analysisValueKey ? analysisValue ?? varTooLow : varTooLow
            if (scoreLoss > 0 || exceptKeyNames.includes(keyName)) {
              keyAdjective = 'small'
            }
          } else if (_.isFinite(varTooHigh) && varTooHigh > 0) {
            const scoring = factor.scoringTooHigh ? factor.scoringTooHigh : factor.scoring
            if (_.isNumber(scoring.relativeScaleFactor)) {
              // if the grading is relative to the magnitude of the answer, we need to grab it
              let minValue = _.get(closestCorrectAnswerGroup.min, factorName)
              let maxValue = _.get(closestCorrectAnswerGroup.max, factorName)
              scoring.relativeMidpoint = (maxValue + minValue) / 2
            }
            scoreLoss = applyScaling(varTooHigh, scoring)
            keyValue = analysisValueKey ? analysisValue ?? varTooHigh : varTooHigh
            if (scoreLoss > 0 || exceptKeyNames.includes(keyName)) {
              keyAdjective = 'big'
            }
          }
        } else {
          //console.log('====info', keyName, varOff)

          if (_.isFinite(varOff)) {
            const scoring = factor.scoring
            keyValue = varOff
            scoreLoss = applyScaling(varOff, scoring)
            if (scoreLoss > 0 || exceptKeyNames.includes(keyName)) {
              keyAdjective = 'wrong'
            }
          }
        }

        addTrafficLightFromScoreReduction(keyName, scoreLoss)
      } else {
        if (!_.isNil(varShouldBe)) {
          scoreLoss = factor.scoring.linearFactor
          keyAdjective = 'wrong'
          keyValue = varShouldBe
          addTrafficLightBoolean(keyName, false)
        } else {
          addTrafficLightBoolean(keyName, true)
        }
      }
      add(keyName, keyAdjective, keyValue, scoreLoss, factorName)
    }
  })

  score = _.clamp(_.round(score, 2), 0, 100)
  return {
    score,
    analysis,
    trafficLights,
  }
}

module.exports = {
  getGroupsFromIdentsArray,
  calculateScoreVariables,
  calculateGroupScoreVariables,
  serializeGroupScoreVariables,
  flatScoreFromGroupScoreVariables,
  getRubric,
  // Exposed for testing rubric-cache isolation and pool-leak detection
  buildRubric,
  _getDefaultRubric: () => _cachedDefaultRubric,
  _getV3PoolTop: () => _v3Pool.checkpoint(),
}
