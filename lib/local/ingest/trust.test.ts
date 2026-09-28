import { describe, expect, it } from 'vitest'
import { deriveEvidenceLevel, deriveVerificationStatus, computeConfidence } from './trust'

describe('deriveEvidenceLevel (§4.1)', () => {
  it('official/utility/dataset/sensor = 1', () => {
    for (const t of ['official_agency', 'utility', 'public_dataset', 'sensor'])
      expect(deriveEvidenceLevel({ sourceType: t })).toBe(1)
  })
  it('journalism tier 1–6 = 2, tier >6 = 5', () => {
    expect(deriveEvidenceLevel({ sourceType: 'journalism', credibilityTier: 6 })).toBe(2)
    expect(deriveEvidenceLevel({ sourceType: 'journalism', credibilityTier: 7 })).toBe(5)
  })
  it('trusted community/social = 3, untrusted = 5', () => {
    expect(deriveEvidenceLevel({ sourceType: 'community_org', trusted: true })).toBe(3)
    expect(deriveEvidenceLevel({ sourceType: 'social_account', trusted: false })).toBe(5)
    expect(deriveEvidenceLevel({ sourceType: 'user_submission' })).toBe(5)
  })
  it('override wins (e.g. Patch → 3)', () => {
    expect(deriveEvidenceLevel({ sourceType: 'journalism', credibilityTier: 6, evidenceLevelOverride: 3 })).toBe(3)
  })
})

describe('deriveVerificationStatus (§4.3, every branch)', () => {
  it('rule 1 — any level-1 → confirmed', () => {
    expect(deriveVerificationStatus([1])).toBe('confirmed')
    expect(deriveVerificationStatus([5, 1, 3])).toBe('confirmed')
  })
  it('rule 2 — 2×L2, or L2+L3 → confirmed', () => {
    expect(deriveVerificationStatus([2, 2])).toBe('confirmed')
    expect(deriveVerificationStatus([2, 3])).toBe('confirmed')
  })
  it('rule 3 — single L2 → developing', () => {
    expect(deriveVerificationStatus([2])).toBe('developing')
  })
  it('rule 4 — ≥3 at levels 3/5 → community_reports', () => {
    expect(deriveVerificationStatus([3, 5, 5])).toBe('community_reports')
    expect(deriveVerificationStatus([3, 3])).toBe('unverified') // only 2
  })
  it('rule 5 — otherwise unverified', () => {
    expect(deriveVerificationStatus([5])).toBe('unverified')
    expect(deriveVerificationStatus([])).toBe('unverified')
  })
})

describe('computeConfidence (§4.4)', () => {
  it('takes max level base, +0.05 per extra item, × geo factor', () => {
    expect(computeConfidence([1], 'exact')).toBeCloseTo(0.95, 5)
    expect(computeConfidence([2, 2], 'exact')).toBeCloseTo(0.9, 5) // 0.85 + 0.05
    expect(computeConfidence([1], 'county')).toBeCloseTo(0.95 * 0.6, 5)
    expect(computeConfidence([], 'exact')).toBe(0)
  })
  it('caps at 0.99 before the geo factor', () => {
    expect(computeConfidence([1, 1, 1, 1, 1], 'exact')).toBeCloseTo(0.99, 5)
  })
})
