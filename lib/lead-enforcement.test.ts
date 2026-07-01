import { describe, expect, it } from 'vitest'
import { enforceLeadEligibility } from './lead-enforcement'
import type { LeadCandidate } from './lead-eligibility'

// Minimal NeedToKnow-shaped item — the enforcer only needs a slug.
type Item = { slug: string; label: string }

function candidate(overrides: Partial<LeadCandidate> = {}): LeadCandidate {
  return {
    title: 'Placeholder headline',
    description: '',
    subcategory: null,
    category: 'reported',
    source_tier: 3,
    source_type: 'Newsroom',
    msm_outlet_coverage: { covered: ['a', 'b', 'c', 'd', 'e'], notCovered: [] },
    msm_gap: false,
    journalist_username: null,
    source: null,
    region: null,
    ...overrides,
  }
}

// A clean, reported+corroborated+consequential lead (passes every gate).
const ELIGIBLE = candidate({
  title: 'Court ruling forces new regulatory deadline amid escalating policy fight',
})

// The fibula case: single-source AP wire, no broad-public-consequence signal.
// Fails corroboration (single-source) and consequence gates → override_required.
const FIBULA = candidate({
  title: 'Recording artist says wife broke her fibula in an elevator accident',
  source_tier: 2,
  msm_outlet_coverage: { covered: ['ap'], notCovered: [] },
})

const resolver = (map: Record<string, LeadCandidate>) => (slug: string) => map[slug]

describe('enforceLeadEligibility', () => {
  it('leaves an eligible lead untouched with no notice', () => {
    const ntk: Item[] = [{ slug: 'lead', label: 'A' }, { slug: 'two', label: 'B' }]
    const result = enforceLeadEligibility(ntk, resolver({ lead: ELIGIBLE, two: candidate() }))
    expect(result.needToKnow.map(i => i.slug)).toEqual(['lead', 'two'])
    expect(result.notice).toBeUndefined()
    expect(result.reorderedTo).toBeUndefined()
  })

  it('promotes the strongest eligible item when the lead fails the gate', () => {
    const ntk: Item[] = [
      { slug: 'fibula', label: 'Fibula' },
      { slug: 'blocked', label: 'Analysis' },
      { slug: 'strong', label: 'Court ruling' },
    ]
    const result = enforceLeadEligibility(
      ntk,
      resolver({
        fibula: FIBULA,
        blocked: candidate({ category: 'analysis' }), // blocked content-type, skipped
        strong: ELIGIBLE,
      })
    )
    expect(result.needToKnow.map(i => i.slug)).toEqual(['strong', 'fibula', 'blocked'])
    expect(result.reorderedTo).toBe('strong')
    expect(result.notice).toBeUndefined()
  })

  it('keeps the lead but emits a degraded notice when nothing is eligible', () => {
    const ntk: Item[] = [
      { slug: 'fibula', label: 'Fibula' },
      { slug: 'analysis', label: 'Analysis' },
    ]
    const result = enforceLeadEligibility(
      ntk,
      resolver({ fibula: FIBULA, analysis: candidate({ category: 'analysis' }) })
    )
    expect(result.needToKnow.map(i => i.slug)).toEqual(['fibula', 'analysis'])
    expect(result.reorderedTo).toBeUndefined()
    expect(result.notice?.message).toMatch(/degraded eligibility/i)
    expect(result.notice?.failedGates.length).toBeGreaterThan(0)
  })

  it('returns an empty list unchanged', () => {
    const result = enforceLeadEligibility([] as Item[], resolver({}))
    expect(result.needToKnow).toEqual([])
    expect(result.notice).toBeUndefined()
  })

  it('leaves the lead as-is when its story cannot be resolved (missing data is not a failure)', () => {
    const ntk: Item[] = [{ slug: 'unknown', label: 'X' }, { slug: 'strong', label: 'Y' }]
    const result = enforceLeadEligibility(ntk, resolver({ strong: ELIGIBLE }))
    expect(result.needToKnow.map(i => i.slug)).toEqual(['unknown', 'strong'])
    expect(result.notice).toBeUndefined()
  })
})
