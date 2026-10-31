import { describe, expect, it } from 'vitest'
import { getPublicSourceLabel } from '@/components/TierBadge'

describe('getPublicSourceLabel', () => {
  it('maps source types to public labels with the tier suffix', () => {
    expect(getPublicSourceLabel('Independent Commentary', 7)).toBe('Commentary / Analysis · T7')
    expect(getPublicSourceLabel('Wire Service', 4)).toBe('Wire · T4')
    expect(getPublicSourceLabel('Public Broadcaster', 3)).toBe('Public Media · T3')
  })

  it('respects content_type: a REPORTING clip from a commentary source is not labeled "Commentary / Analysis"', () => {
    expect(getPublicSourceLabel('Independent Commentary', 7, 'reported')).toBe('Independent · T7')
    expect(getPublicSourceLabel('Independent Commentary', 7, 'investigative')).toBe('Independent · T7')
    expect(getPublicSourceLabel('Newsroom (Satire)', 6, 'reported')).toBe('General Newsroom · T6')
  })

  it('leaves the commentary label when content_type is actually commentary/analysis', () => {
    expect(getPublicSourceLabel('Independent Commentary', 7, 'commentary_analysis')).toBe('Commentary / Analysis · T7')
    expect(getPublicSourceLabel('Independent Commentary', 7, 'opinion')).toBe('Commentary / Analysis · T7')
    expect(getPublicSourceLabel('Independent Commentary', 7)).toBe('Commentary / Analysis · T7')
  })
})
