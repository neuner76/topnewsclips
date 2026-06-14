import { describe, expect, it } from 'vitest'
import { prefilterCandidatePool, type PrefilterCandidate } from './digest-prefilter'

const covered = (n: number) => ({ covered: Array.from({ length: n }, (_, i) => `o${i}`), notCovered: [] })

function cand(o: Partial<PrefilterCandidate>): PrefilterCandidate {
  return {
    slug: o.slug ?? 's', title: '', description: '', category: 'reported',
    source_tier: 5, source_type: 'Independent Journalist', msm_outlet_coverage: null,
    msm_gap: false, journalist_username: null, source: null, region: null, subcategory: null,
    ...o,
  }
}

describe('prefilterCandidatePool (conservative, pre-LLM)', () => {
  it('removes an uncorroborated single-source state-affiliated high-stakes item', () => {
    const pool = [
      cand({ slug: 'state', title: 'State outlet reports troop movement in escalating war', source_tier: 8, source_type: 'State Media', msm_outlet_coverage: covered(0) }),
      cand({ slug: 'keep', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) }),
    ]
    const { kept, removed } = prefilterCandidatePool(pool)
    expect(kept.map(s => s.slug)).toEqual(['keep'])
    expect(removed[0]).toMatchObject({ slug: 'state' })
  })

  it('keeps a corroborated state-affiliated high-stakes item (caution handled downstream)', () => {
    const pool = [cand({ slug: 'state', title: 'State outlet reports airstrike in war zone', source_tier: 8, source_type: 'State Media', msm_outlet_coverage: covered(5) })]
    expect(prefilterCandidatePool(pool).kept.map(s => s.slug)).toEqual(['state'])
  })

  it('removes lightweight human-interest with no role', () => {
    const pool = [cand({ slug: 'puppy', title: 'Adorable puppy goes viral', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) })]
    const { kept, removed } = prefilterCandidatePool(pool)
    expect(kept).toHaveLength(0)
    expect(removed[0].reason).toMatch(/human-interest/)
  })

  it('keeps substantive stories and lets borderline editorial calls through', () => {
    const pool = [
      cand({ slug: 'health', title: 'Screwworm disease outbreak hits Texas cattle', source_tier: 2, msm_outlet_coverage: covered(6) }),
      cand({ slug: 'cars', title: 'Used-car prices climb amid inflation', source_tier: 4, msm_outlet_coverage: covered(5) }),
      cand({ slug: 'satire', title: 'Daily Show skewers hearing', category: 'comedy', source_tier: 6, source_type: 'Satire' }),
      // a minor but real political item — must NOT be floor-removed
      cand({ slug: 'primary', title: 'Maine Democrat wins uncontested Senate primary', source_tier: 4, msm_outlet_coverage: covered(0), msm_gap: true }),
    ]
    const { kept } = prefilterCandidatePool(pool)
    expect(kept.map(s => s.slug).sort()).toEqual(['cars', 'health', 'primary', 'satire'])
  })

  it('does not remove on relational grounds — two same-topic stories both survive', () => {
    const pool = [
      cand({ slug: 'iran1', title: 'Iran missile strike escalates war', source_tier: 2, msm_outlet_coverage: covered(8) }),
      cand({ slug: 'iran2', title: 'Iran ceasefire deal disputed by both sides', source_tier: 3, msm_outlet_coverage: covered(5) }),
    ]
    expect(prefilterCandidatePool(pool).kept).toHaveLength(2)
  })
})
