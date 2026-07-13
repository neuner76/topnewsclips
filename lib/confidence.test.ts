import { describe, expect, it } from 'vitest'
import { getConfidenceLabel } from './confidence'
import type { Story } from './types'

const cov = (n: number) => ({
  covered: Array.from({ length: n }, (_, i) => `o${i}`),
  notCovered: Array.from({ length: Math.max(0, 15 - n) }, (_, i) => `u${i}`),
})
const label = (source_tier: number, n: number, category: Story['category'] = 'reported') =>
  getConfidenceLabel({ category, source_tier, msm_outlet_coverage: cov(n), msm_gap: false })

describe('getConfidenceLabel', () => {
  it('corroborates a broadly-covered story from a credible tier', () => {
    expect(label(3, 7)).toBe('CORROBORATED')
    expect(label(5, 3)).toBe('CORROBORATED')
  })

  it('B3: a Tier 8 origin with MODEST coverage is still not auto-corroborated', () => {
    // Up to 5 outlets could be a syndicated echo of one state narrative from a
    // low-trust origin — downgrade until independence is clearer.
    expect(label(8, 5)).toBe('DEVELOPING')
    expect(label(8, 2)).toBe('DEVELOPING')
  })

  it('lifts a low-tier origin to CORROBORATED when STRONG independent MSM coverage confirms it', () => {
    // 6+ of the 15 curated independent Western outlets covering a story can't be
    // one low-trust source's syndicated echo — that is genuine corroboration
    // regardless of which low-tier channel clipped it first. (Regression: a Tier 8
    // YouTube clip of Sen. Graham's death carried 8 MSM outlets yet was capped at
    // DEVELOPING, so it never reached Need To Know.)
    expect(label(8, 8)).toBe('CORROBORATED')
    expect(label(8, 6)).toBe('CORROBORATED')
    expect(label(10, 7)).toBe('CORROBORATED')
  })

  it('keeps single-source for a state-affiliated origin with little coverage', () => {
    expect(label(8, 1)).toBe('SINGLE-SOURCE')
  })

  it('labels institutional tiers Reported even without external coverage', () => {
    expect(label(6, 0)).toBe('REPORTED')
  })

  it('labels analysis and comedy by content type', () => {
    expect(label(3, 9, 'analysis')).toBe('ANALYSIS')
    expect(label(3, 9, 'comedy')).toBe(null)
  })
})
