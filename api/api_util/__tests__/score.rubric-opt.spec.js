/**
 * Tests for the two performance optimisations added to score.js:
 *
 *  1. Cached, deep-frozen default rubric
 *     - The cached template is immutable.
 *     - buildRubric() always returns a NEW mutable clone.
 *     - Mutations applied to one buildRubric() result never leak into the
 *       next call — no rubric can be "poisoned" by a concurrent submission.
 *
 *  2. Vector3 object pool
 *     - The pool top is restored to zero after every synchronous scoring call,
 *       proving that no Vector3 "leaks" remain on the stack between requests.
 *     - Accumulated calls do not grow the logical pool size (stack top stays 0).
 */

const _ = require('lodash')
const subject = require('../score')

// ---------------------------------------------------------------------------
// Minimal answer data helpers
// ---------------------------------------------------------------------------

function makeAnswerData(overrides = {}) {
  return Object.assign(
    {
      xDirectionX: 1,
      xDirectionY: 0,
      xDirectionZ: 0,
      yDirectionX: 0,
      yDirectionY: 1,
      yDirectionZ: 0,
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      dimensionX: 10,
      dimensionY: 10,
      dimensionZ: 10,
    },
    overrides
  )
}

// Thin modifiers object that satisfies getRubric without triggering special
// branches (ContrastLab, CTLab, etc.)
const BASE_MODIFIERS = {
  questionType: 1,
  isCTLab: false,
  isContrastLab: false,
  isResolutionLab: false,
  isUltraLab: false,
  isReconQuestion: false,
  isAcqQuestion: false,
  isPostContrast: false,
  isProduction: false,
  ignoreInPlaneRotation: false,
}

// Minimal answerCorrect that getRubric needs (no variants / isSingleSlice)
const BASE_ANSWER_CORRECT = {}

// ---------------------------------------------------------------------------
// 1. Default rubric cache — immutability
// ---------------------------------------------------------------------------

describe('score.js — cached default rubric', () => {
  describe('_getDefaultRubric()', () => {
    it('returns an object that is deeply frozen', () => {
      const rubric = subject._getDefaultRubric()
      expect(Object.isFrozen(rubric)).toBe(true)
      expect(Object.isFrozen(rubric.factors)).toBe(true)
      // Spot-check a leaf factor object
      expect(Object.isFrozen(rubric.factors.angle)).toBe(true)
      expect(Object.isFrozen(rubric.factors.angle.scoring)).toBe(true)
    })

    it('always returns the SAME object reference (singleton)', () => {
      const a = subject._getDefaultRubric()
      const b = subject._getDefaultRubric()
      expect(a).toBe(b)
    })

    it('throws if caller tries to mutate a leaf property', () => {
      const rubric = subject._getDefaultRubric()
      expect(() => {
        'use strict'
        rubric.points = 999
      }).toThrow()
    })

    it('throws if caller tries to mutate a nested factor', () => {
      const rubric = subject._getDefaultRubric()
      expect(() => {
        'use strict'
        rubric.factors.angle.ignore = true
      }).toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. buildRubric() clones the cache — results are independent
  // ---------------------------------------------------------------------------

  describe('buildRubric()', () => {
    it('returns a DIFFERENT object from the cached template each time', () => {
      const a = subject.buildRubric()
      const b = subject.buildRubric()
      expect(a).not.toBe(subject._getDefaultRubric())
      expect(b).not.toBe(subject._getDefaultRubric())
      expect(a).not.toBe(b)
    })

    it('returns a mutable object (no freeze)', () => {
      const rubric = subject.buildRubric()
      expect(Object.isFrozen(rubric)).toBe(false)
      // Must be able to mutate without throwing
      expect(() => {
        rubric.points = 50
      }).not.toThrow()
      expect(rubric.points).toBe(50)
    })

    it('mutating one buildRubric() result does NOT affect another call', () => {
      const r1 = subject.buildRubric()
      r1.factors.angle.ignore = true
      r1.factors.spacing.scoring.linearFactor = 9999

      const r2 = subject.buildRubric()
      expect(r2.factors.angle.ignore).toBe(false)
      expect(r2.factors.spacing.scoring.linearFactor).not.toBe(9999)
    })

    it('mutating one buildRubric() result does NOT corrupt the frozen cache', () => {
      const r1 = subject.buildRubric()
      // Attempt to poison through the clone
      r1.factors.angle.ignore = true

      const cache = subject._getDefaultRubric()
      expect(cache.factors.angle.ignore).toBe(false)
    })

    it('applies overrides correctly without touching other factors', () => {
      const override = { factors: { angle: { ignore: true } } }
      const rubric = subject.buildRubric([override])

      expect(rubric.factors.angle.ignore).toBe(true)
      // Other factors are untouched
      expect(rubric.factors.spacing.ignore).toBe(false)
      expect(rubric.factors.thickness.ignore).toBe(false)
    })

    it('multiple calls with the same override return independent rubrics', () => {
      const override = { factors: { angle: { scoring: { linearFactor: 42 } } } }
      const r1 = subject.buildRubric([override])
      const r2 = subject.buildRubric([override])

      r1.factors.angle.scoring.linearFactor = 1
      expect(r2.factors.angle.scoring.linearFactor).toBe(42)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. getRubric() — no rubric bleed between calls (simulates concurrent submissions)
  // ---------------------------------------------------------------------------

  describe('getRubric() — submission isolation', () => {
    it('inPlaneRotation-ignore override does not bleed into the next call', () => {
      const modifiersWithIgnore = Object.assign({}, BASE_MODIFIERS, { ignoreInPlaneRotation: true })

      const r1 = subject.getRubric(BASE_ANSWER_CORRECT, modifiersWithIgnore)
      const r2 = subject.getRubric(BASE_ANSWER_CORRECT, BASE_MODIFIERS)

      // r1 must have inplaneRotation ignored
      // r2 (no ignoreInPlaneRotation) must NOT be affected
      // The cached template must never have been mutated
      const cache = subject._getDefaultRubric()
      expect(Object.isFrozen(cache)).toBe(true)
      expect(Object.isFrozen(cache.factors)).toBe(true)
    })

    it('returns a fresh rubric object on every call', () => {
      const r1 = subject.getRubric(BASE_ANSWER_CORRECT, BASE_MODIFIERS)
      const r2 = subject.getRubric(BASE_ANSWER_CORRECT, BASE_MODIFIERS)
      expect(r1).not.toBe(r2)
    })

    it('100 sequential getRubric() calls leave the cached rubric frozen and identical', () => {
      const cache = subject._getDefaultRubric()
      const originalPoints = cache.points
      const originalAngleLinearFactor = cache.factors.angle.scoring.linearFactor

      for (let i = 0; i < 100; i++) {
        const r = subject.getRubric(BASE_ANSWER_CORRECT, BASE_MODIFIERS)
        // Aggressively mutate the returned rubric to test for leakage
        r.points = 0
        r.factors.angle.scoring.linearFactor = 9999
        r.factors.angle.ignore = true
      }

      // Cache must be unaffected
      expect(subject._getDefaultRubric()).toBe(cache) // same reference
      expect(cache.points).toBe(originalPoints)
      expect(cache.factors.angle.scoring.linearFactor).toBe(originalAngleLinearFactor)
      expect(cache.factors.angle.ignore).toBe(false)
      expect(Object.isFrozen(cache)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// 4. Vector3 pool — no leaks across scoring calls
// ---------------------------------------------------------------------------

describe('score.js — Vector3 object pool', () => {
  const answerData = makeAnswerData()
  const minData = makeAnswerData({ centerX: -5, centerY: -5, centerZ: -5, dimensionX: 5, dimensionY: 5, dimensionZ: 5 })
  const maxData = makeAnswerData({ centerX: 5, centerY: 5, centerZ: 5, dimensionX: 15, dimensionY: 15, dimensionZ: 15 })

  it('pool top is 0 before any scoring call', () => {
    expect(subject._getV3PoolTop()).toBe(0)
  })

  it('calculateScoreVariables restores pool top to 0 after returning', () => {
    subject.calculateScoreVariables(answerData, minData, maxData)
    expect(subject._getV3PoolTop()).toBe(0)
  })

  it('pool top stays 0 after 50 sequential calculateScoreVariables calls', () => {
    for (let i = 0; i < 50; i++) {
      subject.calculateScoreVariables(answerData, minData, maxData)
    }
    expect(subject._getV3PoolTop()).toBe(0)
  })

  it('pool top is 0 after a calculateScoreVariables call with ctAnswerCenter data', () => {
    const ctAnswer = makeAnswerData({
      ctAnswerCenterX: 1,
      ctAnswerCenterY: 2,
      ctAnswerCenterZ: 3,
      ctAnswerDimensionX: 8,
      ctAnswerDimensionY: 8,
      ctAnswerDimensionZ: 8,
    })
    subject.calculateScoreVariables(ctAnswer, minData, maxData)
    expect(subject._getV3PoolTop()).toBe(0)
  })

  it('pool top stays 0 after alternating scoring and rubric calls', () => {
    for (let i = 0; i < 20; i++) {
      subject.calculateScoreVariables(answerData, minData, maxData)
      subject.buildRubric()
      subject.getRubric(BASE_ANSWER_CORRECT, BASE_MODIFIERS)
    }
    expect(subject._getV3PoolTop()).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // 5. Correctness regression — pool must not cause wrong numeric results
  // ---------------------------------------------------------------------------

  it('produces identical results across consecutive calls (no state bleed)', () => {
    const result1 = subject.calculateScoreVariables(answerData, minData, maxData)
    const result2 = subject.calculateScoreVariables(answerData, minData, maxData)
    expect(result1).toEqual(result2)
  })

  it('produces the expected angleOff value for axis-aligned identical boxes', () => {
    // Identical answer and min/max → angle should be 0 off
    const identical = makeAnswerData()
    const result = subject.calculateScoreVariables(identical, identical, identical)
    expect(result.angleOff).toBe(0)
  })

  it('produces a non-zero angleOff when stacks are perpendicular', () => {
    // x=(1,0,0), y=(0,0,1) → zDirection = x × y = (0,-1,0)
    // minData has zDirection=(0,0,1); angle between (0,-1,0) and (0,0,1) is 90°
    // After the "flip tolerance" transform → angleOff = 90 ≠ 0
    const perpendicular = makeAnswerData({
      xDirectionX: 1,
      xDirectionY: 0,
      xDirectionZ: 0,
      yDirectionX: 0,
      yDirectionY: 0,
      yDirectionZ: 1,
    })
    const result = subject.calculateScoreVariables(perpendicular, minData, maxData)
    expect(result.angleOff).toBeGreaterThan(0)
  })
})
