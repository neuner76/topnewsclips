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

  it('B3: a state-affiliated (Tier 8) origin is NOT auto-corroborated on raw outlet count', () => {
    // 7-of-15 would be CORROBORATED for a credible tier, but a T8 origin can be a
    // syndicated echo of one state narrative — downgrade until independence is verified.
    expect(label(8, 7)).toBe('DEVELOPING')
    expect(label(8, 5)).toBe('DEVELOPING')
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
