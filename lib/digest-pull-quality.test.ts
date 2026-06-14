import { describe, expect, it } from 'vitest'
import { validateDigestPullQuality } from './digest-pull-quality'
import type { DigestEdition, CanonicalDigestItem, CanonicalNeedToKnowItem } from './digest-canonical'
import type { Story } from './types'

function story(overrides: Partial<Story>): Story {
  return {
    id: overrides.slug ?? 't', title: '', slug: overrides.slug ?? 't', description: '',
    embed_url: '', platform: 'youtube', view_count: 0, share_count: 0, msm_gap: false,
    msm_notes: null, msm_outlet_coverage: null, published: true, display_order: 0,
    category: 'reported', subcategory: null, thumbnail_url: null, journalist_username: null,
    source: null, region: null, source_tier: 5, source_type: 'Independent Journalist',
    pinned: false, duration: null, created_at: '2026-06-14', updated_at: '2026-06-14',
    verified_interpretation: null, qc_status: 'pass', qc_failed_checks: null, qc_routing_note: null,
    ...overrides,
  }
}
const covered = (n: number) => ({ covered: Array.from({ length: n }, (_, i) => `o${i}`), notCovered: [] })

function item(id: string, section: CanonicalDigestItem['section'], summary = 'A single clear event happened today.'): CanonicalDigestItem {
  return { id, section, title: id, summary, url: `/story/${id}`, metadata: { source: null, sourceType: 'x', sourceTier: 5, confidence: 'Reported', coverageCount: 1, coverageTotal: 14, handle: null } }
}
function ntk(id: string): CanonicalNeedToKnowItem {
  return { ...item(id, 'Need To Know'), section: 'Need To Know', whatHappened: 'x', whyItMatters: 'y', worldView: [] }
}

function edition(over: Partial<DigestEdition>): DigestEdition {
  return {
    id: 'd', date: '2026-06-14', title: 't',
    needToKnow: [], sections: [], mainstreamPulse: null, globalBlindspot: [], globalLens: [],
    ...over,
  }
}

describe('validateDigestPullQuality (warn-only)', () => {
  it('flags a bundled summary as an error', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Business & Markets', items: [item('biz', 'Business & Markets', 'Prices rose. Meanwhile, a separate merger closed.')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['biz', story({ slug: 'biz', title: 'Used-car prices climb', source_tier: 4, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /Bundled multi-story/.test(e))).toBe(true)
  })

  it('flags a region label that disagrees with the outlet home', () => {
    const ed = edition({ needToKnow: [ntk('lead')], globalBlindspot: [item('gb', 'Global Blindspot')] })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['gb', story({ slug: 'gb', journalist_username: 'arirangnews', source: 'YouTube/Arirang News', region: 'Europe', msm_gap: true })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /Region label disagrees/.test(e))).toBe(true)
  })

  it('warns when Need To Know has only 1 item and annotates story-backed items', () => {
    const ed = edition({ needToKnow: [ntk('lead')] })
    const map = new Map<string, Story>([['lead', story({ slug: 'lead', title: 'Court ruling sets deadline', source_tier: 2, msm_outlet_coverage: covered(6) })]])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Need To Know has 1 item/.test(w))).toBe(true)
    expect(report.annotations).toHaveLength(1)
  })

  it('does not flag the genuine lead in Need To Know as lacking a role', () => {
    // The lead must be scored against PRIOR context only, never itself — else it
    // self-demotes to archive_only and trips a false "lacks role" warning.
    const ed = edition({
      needToKnow: [ntk('lead'), ntk('second')],
      sections: [{ name: 'Politics & World Affairs', items: [item('follow', 'Politics & World Affairs')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) })],
      ['second', story({ slug: 'second', title: 'Supreme Court ruling sets new regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['follow', story({ slug: 'follow', title: 'Used-car prices climb amid inflation', source_tier: 3, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /lead.*lacks a clear digest role/.test(w))).toBe(false)
    expect(report.annotations.find(a => a.id === 'lead')?.role).toBe('lead')
  })

  it('is silent on non-story items (no slug in map)', () => {
    const ed = edition({ needToKnow: [ntk('a'), ntk('b')], sections: [{ name: 'Also Worth Knowing', items: [item('orphan', 'Also Worth Knowing')] }] })
    const map = new Map<string, Story>([
      ['a', story({ slug: 'a', title: 'Court ruling sets deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['b', story({ slug: 'b', title: 'Inflation eases as prices fall', source_tier: 3, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    // orphan has no story, so it contributes no annotation and no crash
    expect(report.annotations.map(a => a.id)).not.toContain('orphan')
  })
})
