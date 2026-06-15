import { describe, expect, it } from 'vitest'
import type { Story } from './types'
import { classifyDigestItemRole } from './digest-role-classifier'
import { calculateDigestPullScore, meetsInclusionThreshold, DIGEST_INCLUSION_THRESHOLD } from './digest-pull-score'
import {
  assessStateAffiliated,
  detectBundledMultistory,
  hasRegionLabelMismatch,
  isHighStakesGeopolitical,
} from './digest-risk'
import { isDuplicateLowerSectionItem, recordPlacement } from './digest-section-rules'
import { emptyDigestContext } from './digest-pull-types'
import {
  applyEditorialOverrides,
  buildCanonicalDigestFromStoryPool,
  validateCanonicalPull,
} from './digest-assembly'
import type { EditorialPullOverride } from './digest-pull-types'

// Minimal Story factory — only the fields the pull layer reads.
function story(overrides: Partial<Story>): Story {
  return {
    id: overrides.slug ?? 't',
    title: '',
    slug: overrides.slug ?? 't',
    description: '',
    embed_url: '',
    platform: 'youtube',
    view_count: 0,
    share_count: 0,
    msm_gap: false,
    msm_notes: null,
    msm_outlet_coverage: null,
    published: true,
    display_order: 0,
    category: 'reported',
    subcategory: null,
    thumbnail_url: null,
    journalist_username: null,
    source: null,
    region: null,
    source_tier: 5,
    source_type: 'Independent Journalist',
    pinned: false,
    duration: null,
    created_at: '2026-06-14',
    updated_at: '2026-06-14',
    verified_interpretation: null,
    qc_status: 'pass',
    qc_failed_checks: null,
    qc_routing_note: null,
    ...overrides,
  }
}

const covered = (n: number) => ({ covered: Array.from({ length: n }, (_, i) => `o${i}`), notCovered: [] })

describe('classifyDigestItemRole', () => {
  it('routes a corroborated agriculture/health story to health_science_context', () => {
    const s = story({ title: 'Screwworm outbreak spreads in Texas cattle', source_tier: 1, msm_outlet_coverage: covered(7) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('health_science_context')
  })

  it('gives a cross-border infrastructure story institutional_signal', () => {
    const s = story({ title: 'Court ruling delays cross-border bridge over regulatory dispute', source_tier: 3, msm_outlet_coverage: covered(4) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('institutional_signal')
  })

  it('gives a used-car/inflation story economic_context in Business', () => {
    const s = story({ title: 'Used-car prices climb as inflation persists', source_tier: 4, msm_outlet_coverage: covered(5) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('economic_context')
  })

  it('classifies satire as cultural_texture, never a news role', () => {
    const s = story({ title: 'Daily Show skewers Senate hearing', category: 'comedy', source_tier: 6, source_type: 'Satire' })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('cultural_texture')
  })

  it('demotes a same-topic follow-up to archive when the lead already covers it', () => {
    const lead = story({ slug: 'lead', title: 'Iran missile strike escalates war fears', source_tier: 2, msm_outlet_coverage: covered(8) })
    let ctx = emptyDigestContext()
    expect(classifyDigestItemRole(lead, ctx)).toBe('lead')
    ctx = recordPlacement(ctx, lead, 'lead', null, true)
    // an analysis follow-up on Iran adds no distinct role
    const followup = story({ slug: 'fu', title: 'What the Iran missile strike means', category: 'analysis', source_tier: 4 })
    expect(classifyDigestItemRole(followup, ctx)).toBe('archive_only')
  })

  it('treats raw footage with no coverage as archive_only', () => {
    const s = story({ title: 'Raw: flooding in the Midwest', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('archive_only')
  })

  it('matches inflected geopolitics forms (strikes/ceasefire) not just singulars', () => {
    // "strikes" / "ceasefire deal" must classify as geopolitics, not fall to the
    // proper-noun fallback. Strong source + high-stakes => lead.
    const s = story({ title: 'Trump cancels planned Iran strikes, citing ceasefire deal', source_tier: 6, msm_outlet_coverage: covered(0) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('lead')
  })

  it('never classifies an analysis piece as lead', () => {
    const s = story({ title: 'Why the Iran ceasefire strikes deal may not hold', category: 'analysis', source_tier: 3, msm_outlet_coverage: covered(8) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).not.toBe('lead')
  })

  it('routes a US political-process story to institutional_signal', () => {
    const s = story({ title: 'Maine Democrat wins uncontested Senate primary', source_tier: 4, msm_outlet_coverage: covered(0) })
    expect(classifyDigestItemRole(s, emptyDigestContext())).toBe('institutional_signal')
  })

  it('does not penalize a tier<=6 newsroom for zero MSM coverage as if single-source-fringe', () => {
    // A credible newsroom (tier 6) reporting a major event with a 0 coverage
    // count (a headline-match miss) should not be hammered into deep-negative.
    const s = story({ title: 'Trump cancels Iran strikes citing ceasefire deal', source_tier: 6, msm_outlet_coverage: covered(0) })
    expect(calculateDigestPullScore(s).score).toBeGreaterThanOrEqual(DIGEST_INCLUSION_THRESHOLD)
  })
})

describe('state-affiliated safeguard (Task 7)', () => {
  const base = { title: 'State outlet reports troop movement near border in escalating war', source_tier: 8, source_type: 'State Media' }

  it('excludes an uncorroborated single-source T8 high-stakes item', () => {
    const s = story({ ...base, msm_outlet_coverage: covered(0) })
    const a = assessStateAffiliated(s)
    expect(a.flagged).toBe(true)
    expect(a.exclude).toBe(true)
  })

  it('includes the same item WITH caution when corroborated by 5 outlets', () => {
    const s = story({ ...base, msm_outlet_coverage: covered(5) })
    const a = assessStateAffiliated(s)
    expect(a.flagged).toBe(true)
    expect(a.exclude).toBe(false)
    expect(a.caution).toMatch(/state-affiliated/i)
  })

  it('detects high-stakes geopolitical topics', () => {
    expect(isHighStakesGeopolitical(story({ title: 'Ceasefire talks collapse amid airstrikes' }))).toBe(true)
    expect(isHighStakesGeopolitical(story({ title: 'Local bakery wins award' }))).toBe(false)
  })
})

describe('region integrity + bundled detection (Task 7b / 6b)', () => {
  it('flags a region that disagrees with the outlet home', () => {
    // Arirang News is a Korean broadcaster; "Europe" disagrees with its home.
    const s = story({ journalist_username: 'arirangnews', source: 'YouTube/Arirang News', region: 'Europe' })
    expect(hasRegionLabelMismatch(s)).toBe(true)
  })

  it('accepts a region that matches the outlet home', () => {
    const s = story({ journalist_username: 'arirangnews', source: 'YouTube/Arirang News', region: 'Korea' })
    expect(hasRegionLabelMismatch(s)).toBe(false)
  })

  it('detects a bundled two-event summary', () => {
    expect(detectBundledMultistory(story({ description: 'Farmers protest tariffs. Separately, Nigeria adopts EVs.' }))).toBe(true)
    expect(detectBundledMultistory(story({ description: 'Farmers protest new tariff barriers at the border.' }))).toBe(false)
  })
})

describe('duplicate-topic suppression (Task 6)', () => {
  it('suppresses a lower-section item on the lead topic with no distinct role', () => {
    let ctx = emptyDigestContext()
    ctx = recordPlacement(ctx, story({ title: 'Iran missile strike' }), 'lead', null, true)
    const dup = story({ title: 'Iran strike reaction roundup' })
    expect(isDuplicateLowerSectionItem(dup, 'economic_context', ctx)).toBe(true)
    // an institutional follow-up IS distinct
    expect(isDuplicateLowerSectionItem(dup, 'institutional_signal', ctx)).toBe(false)
  })
})

describe('scoring threshold (Task 3)', () => {
  it('keeps a corroborated institutional story above threshold', () => {
    const s = story({ title: 'Supreme Court ruling sets new regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) })
    expect(meetsInclusionThreshold(calculateDigestPullScore(s))).toBe(true)
  })

  it('drops an archive-only lightweight item below threshold', () => {
    const s = story({ title: 'Adorable puppy goes viral', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) })
    const r = calculateDigestPullScore(s)
    expect(r.role).toBe('archive_only')
    expect(meetsInclusionThreshold(r)).toBe(false)
  })
})

describe('canonical assembly (Task 14)', () => {
  it('selects a lead, caps Politics, and routes by role', () => {
    const pool: Story[] = [
      story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) }),
      story({ slug: 'court', title: 'Court ruling forces new regulatory deadline for agencies', source_tier: 3, msm_outlet_coverage: covered(5) }),
      story({ slug: 'cars', title: 'Used-car prices surge amid inflation', source_tier: 4, msm_outlet_coverage: covered(5) }),
      story({ slug: 'worm', title: 'Screwworm disease outbreak hits Texas cattle', source_tier: 2, msm_outlet_coverage: covered(6) }),
      story({ slug: 'puppy', title: 'Adorable puppy goes viral', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) }),
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    expect(result.needToKnow.map(i => i.story.slug)).toContain('lead')
    expect(result.sections['Business & Markets']?.map(i => i.story.slug)).toContain('cars')
    expect(result.sections['Science, Health & Environment']?.map(i => i.story.slug)).toContain('worm')
    expect(result.excluded.map(e => e.story.slug)).toContain('puppy')
    const validation = validateCanonicalPull(result)
    expect(validation.errors).toEqual([])
  })

  it('orders Politics & World Affairs by role priority, not raw score (Task 5)', () => {
    const pool: Story[] = [
      story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) }),
      // Equal scores (4 each) but processed in pool order — wildfire (developing
      // safety) would sort first by score-stability alone. institutional_signal
      // must still come first within Politics & World Affairs.
      story({ slug: 'wildfire', title: 'Wildfire forces evacuation across county', source_tier: 4, msm_outlet_coverage: covered(2) }),
      story({ slug: 'court', title: 'Supreme Court ruling sets new regulatory deadline for agencies', source_tier: 4, msm_outlet_coverage: covered(2) }),
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    const politics = result.sections['Politics & World Affairs'] ?? []
    expect(politics.map(i => i.pull.role)).toEqual(['institutional_signal', 'developing_safety'])
  })

  it('never places a bundled multi-story item', () => {
    const pool: Story[] = [
      story({ slug: 'good', title: 'Court ruling forces new regulatory deadline', source_tier: 2, msm_outlet_coverage: covered(6) }),
      story({ slug: 'bundle', title: 'Two reports', description: 'Zambian farmers face tariffs. Meanwhile, Nigeria adopts EVs.', source_tier: 3, msm_outlet_coverage: covered(2), msm_gap: true, region: 'Africa' }),
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    const placed = [...result.needToKnow, ...Object.values(result.sections).flat(), ...result.globalBlindspot]
    expect(placed.map(i => i.story.slug)).not.toContain('bundle')
    expect(result.excluded.map(e => e.story.slug)).toContain('bundle')
  })
})

describe('editorial pull override (Task 15)', () => {
  it('re-includes an excluded item into the specified section with its reason recorded', () => {
    const pool: Story[] = [
      story({ slug: 'lead', title: 'Iran missile strike escalates war as diplomats scramble', source_tier: 2, msm_outlet_coverage: covered(9) }),
      story({ slug: 'puppy', title: 'Adorable puppy goes viral', category: 'raw', source_tier: 9, source_type: 'Community Clip', msm_outlet_coverage: covered(0) }),
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    expect(result.excluded.map(e => e.story.slug)).toContain('puppy')

    const overrides = new Map<string, EditorialPullOverride>([
      ['puppy', { include: true, section: 'Also Worth Knowing', reason: 'editor pick for lighter texture' }],
    ])
    const overridden = applyEditorialOverrides(result, overrides)
    expect(overridden.excluded.map(e => e.story.slug)).not.toContain('puppy')
    const placed = overridden.sections['Also Worth Knowing']?.find(i => i.story.slug === 'puppy')
    expect(placed).toBeDefined()
    expect(placed?.pull.pullReason).toMatch(/editorial override: editor pick/)
  })

  it('does not suppress state-affiliated caution when overriding', () => {
    const pool: Story[] = [
      story({ slug: 'lead', title: 'Court ruling forces new regulatory deadline for agencies', source_tier: 2, msm_outlet_coverage: covered(6) }),
      // Uncorroborated single-source state-affiliated high-stakes -> hard-excluded.
      story({ slug: 'state', title: 'State outlet reports troop movement near border in escalating war', source_tier: 8, source_type: 'State Media', msm_outlet_coverage: covered(0) }),
    ]
    const result = buildCanonicalDigestFromStoryPool(pool)
    expect(result.excluded.map(e => e.story.slug)).toContain('state')

    const overrides = new Map<string, EditorialPullOverride>([
      ['state', { include: true, section: 'Politics & World Affairs', reason: 'editor judgment: relevant despite single source' }],
    ])
    const overridden = applyEditorialOverrides(result, overrides)
    const placed = overridden.sections['Politics & World Affairs']?.find(i => i.story.slug === 'state')
    expect(placed?.caution).toMatch(/state-affiliated/i)
  })
})
