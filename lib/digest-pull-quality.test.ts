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

  it('flags a World view lens covering a different event than its lead (Task 7b)', () => {
    const lensItem = { ...item('ecb', 'Global Lens'), title: 'ECB raises interest rates' }
    const ed = edition({
      needToKnow: [{ ...ntk('lead'), worldView: [lensItem] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) })],
      ['ecb', story({ slug: 'ecb', title: 'ECB raises interest rates amid inflation concerns', source_tier: 3, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /World view lens covers a different event/.test(e))).toBe(true)
  })

  it('does not flag a World view lens covering the same core event', () => {
    const lensItem = { ...item('ecb', 'Global Lens'), title: 'Iran reaction from Tehran' }
    const ed = edition({
      needToKnow: [{ ...ntk('lead'), worldView: [lensItem] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) })],
      ['ecb', story({ slug: 'ecb', title: 'Iran says missile strike was a defensive measure', source_tier: 3, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /World view lens covers a different event/.test(e))).toBe(false)
  })

  it('warns when Global Blindspot exceeds its cap (Task 12)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      globalBlindspot: ['gb1', 'gb2', 'gb3', 'gb4', 'gb5'].map(id => item(id, 'Global Blindspot')),
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ...['gb1', 'gb2', 'gb3', 'gb4', 'gb5'].map(id => [id, story({ slug: id, title: `Undercovered story ${id}`, msm_gap: true, region: 'Africa', msm_outlet_coverage: covered(1) })] as const),
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Global Blindspot has 5 items \(cap 4\)/.test(w))).toBe(true)
  })

  it('warns when Global Lens exceeds its cap or duplicates a base story (Task 13)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      globalLens: ['l1', 'l1', 'l2', 'l3'].map(id => item(id, 'Global Lens')),
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ...['l1', 'l2', 'l3'].map(id => [id, story({ slug: id, title: `Global angle ${id}` })] as const),
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Global Lens has 4 items \(cap 3\)/.test(w))).toBe(true)
    expect(report.warnings.some(w => /Global Lens duplicates base-story summary: l1/.test(w))).toBe(true)
  })

  it('warns when raw footage defines Science, Health & Environment (Task 8)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Science, Health & Environment', items: [item('raw', 'Science, Health & Environment')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['raw', story({ slug: 'raw', title: 'Raw: flooding hits Midwest farms', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Raw footage defines Science, Health & Environment: raw/.test(w))).toBe(true)
  })

  it('warns when a cultural texture item carries a news confidence label instead of "Cultural lens" (Task 10)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Culture, Media & Society', items: [item('satire', 'Culture, Media & Society')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['satire', story({ slug: 'satire', title: 'Daily Show skewers Senate hearing', category: 'comedy', source_tier: 6, source_type: 'Satire' })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Cultural texture item should show "Cultural lens"/.test(w))).toBe(true)
  })

  it('warns on a Global Blindspot item with no outlet, only a country/region label (Task 16)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      globalBlindspot: [item('gb', 'Global Blindspot')],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['gb', story({ slug: 'gb', title: 'Undercovered regional story', msm_gap: true, region: 'Africa', source: null, journalist_username: null, msm_outlet_coverage: covered(1) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Global Blindspot item has no outlet, only a country\/region label: gb/.test(w))).toBe(true)
  })

  it('warns on a 0-of-N story in a mainstream section without a label (Task 11)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Politics & World Affairs', items: [{ ...item('uncov', 'Politics & World Affairs'), metadata: { source: 'x', sourceType: 'x', sourceTier: 5, confidence: 'Reported', coverageCount: 0, coverageTotal: 15, handle: null, caution: null } }] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['uncov', story({ slug: 'uncov', title: 'Defence official resigns amid policy dispute', source_tier: 5, msm_outlet_coverage: covered(0) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /0-of-15 story appears in Politics & World Affairs/.test(w))).toBe(true)
  })

  it('does not warn when the 0-of-N story carries a Limited Coverage label (Task 11)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Politics & World Affairs', items: [{ ...item('uncov', 'Politics & World Affairs'), metadata: { source: 'x', sourceType: 'x', sourceTier: 5, confidence: 'Reported', coverageCount: 0, coverageTotal: 15, handle: null, caution: 'Limited Coverage' } }] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['uncov', story({ slug: 'uncov', title: 'Defence official resigns', source_tier: 5, msm_outlet_coverage: covered(0), msm_gap: true })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /appears in Politics & World Affairs/.test(w))).toBe(false)
  })

  it('warns when 3+ primary sections each hold only one item (Task 15)', () => {
    const ed = edition({
      needToKnow: [ntk('lead'), ntk('second')],
      sections: [
        { name: 'Politics & World Affairs', items: [item('p', 'Politics & World Affairs')] },
        { name: 'Business & Markets', items: [item('b', 'Business & Markets')] },
        { name: 'Science, Health & Environment', items: [item('s', 'Science, Health & Environment')] },
      ],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['second', story({ slug: 'second', title: 'Inflation eases as prices fall', source_tier: 3, msm_outlet_coverage: covered(5) })],
      ['p', story({ slug: 'p', title: 'Senate passes infrastructure bill', source_tier: 3, msm_outlet_coverage: covered(5) })],
      ['b', story({ slug: 'b', title: 'Used-car prices climb', source_tier: 4, msm_outlet_coverage: covered(5) })],
      ['s', story({ slug: 's', title: 'Disease outbreak prompts recall', source_tier: 2, msm_outlet_coverage: covered(6) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /under-filled/.test(w))).toBe(true)
  })

  it('errors when the live lead is a Commentary/Analysis weak-format story (Tasks 2–5)', () => {
    const ed = edition({ needToKnow: [ntk('weaklead')] })
    const map = new Map<string, Story>([
      ['weaklead', story({ slug: 'weaklead', title: 'How AI war propaganda reshapes the conflict', category: 'analysis', source_tier: 7, msm_outlet_coverage: covered(2), msm_gap: true })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /Lead is ineligible/.test(e))).toBe(true)
  })

  it('warns when a card renders in a section other than its classified section_fit (6.1)', () => {
    // SpaceX classified for Business but rendered under Politics.
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Politics & World Affairs', items: [item('spacex', 'Politics & World Affairs')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['spacex', story({ slug: 'spacex', title: 'SpaceX lands new launch contract', source_tier: 3, msm_outlet_coverage: covered(5), section_fit: 'Business & Markets' })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Section-fit mismatch.*spacex.*Politics & World Affairs.*Business & Markets/.test(w))).toBe(true)
  })

  it('warns when raw footage classified for Also Worth Knowing renders in Science (6.1)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Science, Health & Environment', items: [item('tornado', 'Science, Health & Environment')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['tornado', story({ slug: 'tornado', title: 'Raw: tornado tears through town', source_tier: 5, msm_outlet_coverage: covered(3), section_fit: 'Also Worth Knowing' })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Section-fit mismatch.*tornado/.test(w))).toBe(true)
  })

  it('does not warn when the rendered section matches section_fit (6.1)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Business & Markets', items: [item('biz', 'Business & Markets')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['biz', story({ slug: 'biz', title: 'Used-car prices climb', source_tier: 4, msm_outlet_coverage: covered(5), section_fit: 'Business & Markets' })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Section-fit mismatch/.test(w))).toBe(false)
  })

  it('does not warn when section_fit is absent (unclassified rows) (6.1)', () => {
    const ed = edition({
      needToKnow: [ntk('lead')],
      sections: [{ name: 'Politics & World Affairs', items: [item('p', 'Politics & World Affairs')] }],
    })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })],
      ['p', story({ slug: 'p', title: 'Senate passes infrastructure bill', source_tier: 3, msm_outlet_coverage: covered(5) })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Section-fit mismatch/.test(w))).toBe(false)
  })

  it('does not warn on a lead in Need To Know whose section_fit is a topical section (placement, not topical fit) (6.1)', () => {
    const ed = edition({ needToKnow: [ntk('lead')] })
    const map = new Map<string, Story>([
      ['lead', story({ slug: 'lead', title: 'Court ruling sets regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6), section_fit: 'Business & Markets' })],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.warnings.some(w => /Section-fit mismatch/.test(w))).toBe(false)
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
