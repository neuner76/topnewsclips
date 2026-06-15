import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import {
  buildCanonicalDigestFromStoryPool,
  validateCanonicalPull,
} from './digest-assembly'
import {
  deriveLeadContentType,
  evaluateLeadEligibility,
  checkLeadContentType,
  checkLeadSourceTier,
  checkLeadCorroboration,
} from './lead-eligibility'
import type { SourcePolicy } from './source-policy'
import type { Story } from './types'

describe('deriveLeadContentType (Task 0 mapping)', () => {
  it('maps category to the gate enum without a contentType field', () => {
    expect(deriveLeadContentType({ category: 'comedy', source_tier: 6 })).toBe('satire')
    expect(deriveLeadContentType({ category: 'analysis', source_tier: 3 })).toBe('commentary_analysis')
    expect(deriveLeadContentType({ category: 'analysis', source_tier: 7 })).toBe('creator_commentary')
    expect(deriveLeadContentType({ category: 'raw', source_tier: 9 })).toBe('raw_footage')
    expect(deriveLeadContentType({ category: 'reported', source_tier: 3 })).toBe('reported')
    expect(deriveLeadContentType({ category: null, source_tier: 3 })).toBe('reported')
  })
})

describe('lead eligibility gates (Tasks 2–5)', () => {
  it('lets a reported, corroborated T3 story lead', () => {
    expect(evaluateLeadEligibility(fixtures.reportedCorroboratedLead).status).toBe('eligible')
  })

  it('blocks a Commentary/Analysis story from the lead slot', () => {
    expect(checkLeadContentType(fixtures.commentaryAnalysisLowCoverageStory).status).toBe('blocked')
    expect(evaluateLeadEligibility(fixtures.commentaryAnalysisLowCoverageStory).status).toBe('blocked')
  })

  it('requires override for a T7 source', () => {
    const t7Reported: Story = { ...fixtures.reportedCorroboratedLead, source_tier: 7 }
    expect(checkLeadSourceTier(t7Reported).status).toBe('override_required')
  })

  it('blocks a T8 source from the lead by default', () => {
    const t8: Story = { ...fixtures.reportedCorroboratedLead, source_tier: 8 }
    expect(checkLeadSourceTier(t8).status).toBe('blocked')
  })

  it('requires override for a 2-of-14 story', () => {
    const lowCov: Story = { ...fixtures.reportedCorroboratedLead, msm_outlet_coverage: { covered: ['a', 'b'], notCovered: Array.from({ length: 12 }, (_, i) => `u${i}`) } }
    expect(checkLeadCorroboration(lowCov).status).toBe('override_required')
  })

  it('requires override for a single-source story', () => {
    const single: Story = { ...fixtures.reportedCorroboratedLead, msm_outlet_coverage: { covered: ['a'], notCovered: [] } }
    expect(checkLeadCorroboration(single).status).toBe('override_required')
  })

  it('lifts an override_required gate only with a reason', () => {
    const t7: Story = { ...fixtures.reportedCorroboratedLead, source_tier: 7 }
    expect(evaluateLeadEligibility(t7).status).toBe('override_required')
    expect(evaluateLeadEligibility(t7, { override: { allowLead: true, reason: 'Editor: most consequential story today' } }).status).toBe('eligible')
    // a hard block is never lifted by an override
    expect(evaluateLeadEligibility(fixtures.commentaryAnalysisLowCoverageStory, { override: { allowLead: true, reason: 'x' } }).status).toBe('blocked')
  })
})

describe('restricted-source policy at the lead gate (Tasks 5, 9)', () => {
  const vicePolicy: SourcePolicy = {
    handle: 'vicenews',
    status: 'pending_reclassification',
    blockedSlots: ['lead', 'need_to_know'],
    blockedSections: [],
    reason: 'VICE relaunch under review.',
  }

  it('@vicenews restricted fixture cannot lead', () => {
    const result = evaluateLeadEligibility(fixtures.restrictedViceStory, { policy: vicePolicy })
    expect(result.status).not.toBe('eligible')
    expect(result.reasons.join(' ')).toMatch(/vicenews/i)
  })
})

describe('degraded-lead fallback (Task 5b)', () => {
  it('leads with the strongest override-required story and warns when none is eligible', () => {
    // No eligible lead: a strong-but-T7 reported item and a low-coverage item.
    const pool: Story[] = [
      { ...fixtures.reportedCorroboratedLead, slug: 't7-lead', source_tier: 7, title: 'Court ruling forces new regulatory deadline amid escalating policy fight' },
      { ...fixtures.curiosityDisclosureStory },
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    expect(result.leadDecision?.status).toBe('degraded')
    expect(result.needToKnow.some(i => i.isLead)).toBe(true)
    const validation = validateCanonicalPull(result)
    expect(validation.warnings.some(w => /degraded eligibility/i.test(w))).toBe(true)
  })

  it('holds for review when every lead candidate is blocked', () => {
    // A corroborated T8 state high-stakes story classifies as lead and survives
    // the uncorroborated-state exclusion, but is hard-blocked at the lead gate
    // on source tier — leaving no eligible or override-required lead.
    const pool: Story[] = [
      {
        ...fixtures.stateAffiliatedMigrationClaim,
        slug: 'state-corroborated',
        title: 'State outlet reports major missile strike escalating the war',
        msm_outlet_coverage: { covered: Array.from({ length: 6 }, (_, i) => `o${i}`), notCovered: [] },
        msm_gap: false,
      },
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    expect(result.heldForReview).toBe(true)
    const validation = validateCanonicalPull(result)
    expect(validation.errors.some(e => /hold for review/i.test(e))).toBe(true)
  })
})
