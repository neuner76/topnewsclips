import { describe, expect, it } from 'vitest'
import { confidenceToNumber, proximityScore, localConsequence, blindspotScore } from './scoring'
import { SCORING_WEIGHTS } from './scoring.config'

describe('confidenceToNumber', () => {
  it('maps confidence labels to normalized numbers', () => {
    expect(confidenceToNumber('high')).toBe(1.0)
    expect(confidenceToNumber('medium')).toBe(0.6)
    expect(confidenceToNumber('low')).toBe(0.3)
  })
})

describe('proximityScore', () => {
  it('is 1 at the saved place and 0 at/beyond the radius', () => {
    expect(proximityScore(0, 5)).toBe(1)
    expect(proximityScore(5, 5)).toBe(0)
    expect(proximityScore(10, 5)).toBe(0) // clamped, never negative
  })

  it('falls off linearly within the radius', () => {
    expect(proximityScore(2.5, 5)).toBeCloseTo(0.5, 5)
  })

  it('guards a zero/invalid radius', () => {
    expect(proximityScore(1, 0)).toBe(0)
  })
})

describe('localConsequence', () => {
  const zero = { severity: 0, peopleAffected: 0, proximity: 0, immediacy: 0, duration: 0, institutionalImpact: 0, personalRelevance: 0, confidence: 0 }

  it('is 0 for all-zero inputs and 1 for all-one inputs (weights sum to 1)', () => {
    expect(localConsequence(zero)).toBeCloseTo(0, 5)
    expect(localConsequence({ severity: 1, peopleAffected: 1, proximity: 1, immediacy: 1, duration: 1, institutionalImpact: 1, personalRelevance: 1, confidence: 1 })).toBeCloseTo(1, 5)
  })

  it('reads each weight from config (single-input equals that weight)', () => {
    expect(localConsequence({ ...zero, severity: 1 })).toBeCloseTo(SCORING_WEIGHTS.localConsequence.severity, 5)
    expect(localConsequence({ ...zero, proximity: 1 })).toBeCloseTo(SCORING_WEIGHTS.localConsequence.proximity, 5)
  })

  it('ranks a near fire above a distant minor collision', () => {
    const nearFire = { ...zero, severity: 0.9, proximity: 0.95, immediacy: 0.9, peopleAffected: 0.6, confidence: 1 }
    const distantCollision = { ...zero, severity: 0.3, proximity: 0.1, immediacy: 0.5, peopleAffected: 0.1, confidence: 0.6 }
    expect(localConsequence(nearFire)).toBeGreaterThan(localConsequence(distantCollision))
  })

  it('ranks an official closure above a single-source news report', () => {
    const officialClosure = { ...zero, severity: 0.7, proximity: 0.6, immediacy: 0.8, institutionalImpact: 0.8, confidence: 1 }
    const singleSourceNews = { ...zero, severity: 0.6, proximity: 0.6, immediacy: 0.6, institutionalImpact: 0.4, confidence: 0.3 }
    expect(localConsequence(officialClosure)).toBeGreaterThan(localConsequence(singleSourceNews))
  })
})

describe('blindspotScore', () => {
  it('ranks a zero-coverage major contract above the same contract once covered', () => {
    const base = { consequence: 0.8, localRelevance: 0.8, novelty: 0.7 }
    const uncovered = blindspotScore({ ...base, localMediaCoverage: 0 })
    const covered = blindspotScore({ ...base, localMediaCoverage: 1 })
    expect(uncovered).toBeGreaterThan(covered)
  })

  it('is floored at 0 (well-covered, low-consequence never goes negative)', () => {
    expect(blindspotScore({ consequence: 0.1, localRelevance: 0.1, novelty: 0, localMediaCoverage: 1 })).toBe(0)
  })
})
