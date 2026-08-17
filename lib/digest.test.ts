import { describe, expect, it } from 'vitest'

import {
  fallbackSectionTitle,
  isSoftNeedToKnowStory,
  isUsRelevantForNeedToKnow,
  needToKnowPriorityScore,
  normalizeDigestContent,
  selectNeedToKnowWindow,
  usAudienceRelevanceScore,
} from './digest'

describe('digest title fallbacks', () => {
  it('does not truncate Need To Know replacement titles mid-word', () => {
    expect(fallbackSectionTitle(
      'ProPublica investigation tracks counterterrorism strategy shift under Trump administration official'
    )).toBe(
      'ProPublica investigation tracks counterterrorism strategy shift under Trump administration official'
    )
  })
})

describe('digest content normalization', () => {
  it('fills omitted In The Know categories with empty arrays', () => {
    const content = normalizeDigestContent({
      needToKnow: [],
      inTheKnow: {
        'Politics & World Affairs': [{ text: 'A politics item', slug: 'story-1' }],
      } as never,
      etcetera: [],
    })

    expect(content.inTheKnow['Politics & World Affairs']).toHaveLength(1)
    expect(content.inTheKnow['Science & Technology']).toEqual([])
    expect(content.inTheKnow['Business & Markets']).toEqual([])
    expect(content.inTheKnow['Sports, Entertainment, & Culture']).toEqual([])
    expect(content.inTheKnow['Comedy & Satire']).toEqual([])
  })
})

describe('Need To Know ranking', () => {
  it('treats low-coverage nature trail stories as too soft for lead placement', () => {
    expect(isSoftNeedToKnowStory({
      title: "Singapore Botanic Gardens opens Asia's first Nature Immersion Trail",
      description: 'The trail is designed to encourage visitors to slow down and support mental well-being.',
      source_tier: 3,
      msm_outlet_coverage: { covered: [] },
    })).toBe(true)
  })

  it('prioritizes hard-news stories over soft-interest stories with similar tier and age', () => {
    const now = new Date('2026-06-12T18:00:00.000Z').getTime()
    const hardNews = needToKnowPriorityScore({
      title: 'Labor strike investigation expands after workers allege safety failures',
      description: 'Investigators are reviewing worker safety claims after union members began a strike.',
      source_tier: 4,
      msm_outlet_coverage: { covered: ['apnews.com', 'reuters.com', 'npr.org'] },
      created_at: '2026-06-12T16:00:00.000Z',
      view_count: 100,
    }, now)
    const softStory = needToKnowPriorityScore({
      title: "Singapore Botanic Gardens opens Asia's first Nature Immersion Trail",
      description: 'The trail is designed to encourage visitors to slow down and support mental well-being.',
      source_tier: 3,
      msm_outlet_coverage: { covered: [] },
      created_at: '2026-06-12T16:00:00.000Z',
      view_count: 100,
    }, now)

    expect(hardNews).toBeLessThan(softStory)
  })

  it('scores concrete US reader impact above international-only soft news', () => {
    const usLaborStory = usAudienceRelevanceScore({
      title: 'Federal labor investigation expands after workers allege safety failures',
      description: 'Union workers say the case could affect jobs, workplace safety, and paychecks across the United States.',
      source_tier: 4,
      msm_outlet_coverage: { covered: ['apnews.com'] },
    })
    const internationalSoftStory = usAudienceRelevanceScore({
      title: "Singapore Botanic Gardens opens Asia's first Nature Immersion Trail",
      description: 'The trail is designed to encourage visitors to slow down and support mental well-being.',
      source_tier: 3,
      msm_outlet_coverage: { covered: [] },
    })

    expect(usLaborStory).toBeGreaterThan(internationalSoftStory)
  })

  it('promotes US-relevant public impact over a slightly better-tier distant story', () => {
    const now = new Date('2026-06-12T18:00:00.000Z').getTime()
    const usImpact = needToKnowPriorityScore({
      title: 'Federal court blocks new tax rule affecting workers',
      description: 'The ruling affects taxes, workers, paychecks, and federal policy across the United States.',
      source_tier: 4,
      msm_outlet_coverage: { covered: ['apnews.com', 'reuters.com'] },
      created_at: '2026-06-12T16:00:00.000Z',
      view_count: 500,
    }, now)
    const distantStory = needToKnowPriorityScore({
      title: 'European leaders announce cultural exchange agreement',
      description: 'Officials announced a diplomatic agreement focused on museums, cultural programming, and tourism.',
      source_tier: 3,
      msm_outlet_coverage: { covered: [] },
      created_at: '2026-06-12T16:00:00.000Z',
      view_count: 500,
    }, now)

    expect(usImpact).toBeLessThan(distantStory)
  })
})

// Need To Know eligibility now keys on US-relevance rather than absence-of-region.
// This fixes both region-tagging failure directions at the gate: US stories that
// got a spurious region tag (excluded before) are admitted, and foreign stories
// that dodged tagging (leaked before) are rejected.
describe('isUsRelevantForNeedToKnow', () => {
  const cand = (title: string, description = '') =>
    ({ title, description, source: null, source_tier: 3, msm_outlet_coverage: { covered: [] } })
  const covered = (title: string, description: string, n: number) =>
    ({ title, description, source: null, source_tier: 3, msm_outlet_coverage: { covered: Array.from({ length: n }, (_, i) => `o${i}`) } })

  it('does not read a US term inside another word (substring false positives)', () => {
    // "N-USA-Tenggara" contains "usa"; a foreign earthquake must NOT score as US.
    expect(isUsRelevantForNeedToKnow(covered(
      "Powerful earthquake in Indonesia's East Nusa Tenggara displaces thousands",
      "A powerful earthquake struck Indonesia's East Nusa Tenggara province, Al Jazeera reports.", 10,
    ))).toBe(false)
    // "police" must not match "ice"; "campus" must not match "us".
    expect(isUsRelevantForNeedToKnow(cand('Local police respond to a campus incident in Jakarta'))).toBe(false)
  })

  it('still matches genuine US terms at word boundaries', () => {
    expect(isUsRelevantForNeedToKnow(cand('USA announces sweeping new sanctions'))).toBe(true)
    expect(isUsRelevantForNeedToKnow(cand('The U.S. Senate votes on the housing bill'))).toBe(true)
    expect(isUsRelevantForNeedToKnow(cand('ICE agents detain hundreds in a federal raid'))).toBe(true)
  })

  it('admits a US-domestic story even if region-tagging over-fired on a place word', () => {
    // Was tagged Middle East via "Palestinian" and wrongly dropped from NTK.
    expect(isUsRelevantForNeedToKnow(cand('Illinois names street after six-year-old Palestinian American killed in 2023 hate crime'))).toBe(true)
    // Was tagged Europe (foreign-outlet clip) and wrongly dropped.
    expect(isUsRelevantForNeedToKnow(cand('US judge voids Trump IRS settlement, bars tax audit protection'))).toBe(true)
    expect(isUsRelevantForNeedToKnow(cand('Man fleeing ICE agents struck and killed by semi truck'))).toBe(true)
  })

  it('rejects a foreign story that dodged region tagging (region=null leak)', () => {
    expect(isUsRelevantForNeedToKnow(cand('Telangana Chief Minister Attacks Former CM Over Irrigation Crisis'))).toBe(false)
    expect(isUsRelevantForNeedToKnow(cand('Typhoon Bavi floodwaters sweep vehicles away in Hebei province, China'))).toBe(false)
    expect(isUsRelevantForNeedToKnow(cand('Rescuers search for survivors after deadly Bangkok pub fire'))).toBe(false)
  })

  it('admits a US-anchored international story (US as actor)', () => {
    expect(isUsRelevantForNeedToKnow(cand('US military strikes Iranian targets near Strait of Hormuz'))).toBe(true)
  })

  it('admits a US political figure whose US relevance is in the description', () => {
    expect(isUsRelevantForNeedToKnow(cand(
      'Sen. Lindsey Graham dies at 71 after brief illness',
      'US Senator Lindsey Graham died at age 71, a longtime senator from South Carolina.'
    ))).toBe(true)
  })
})

// The Need To Know recency window falls back from 18h to 48h based on the count
// of ELIGIBLE (US-relevant hard-news) stories, not total stories — a window
// packed with international clips used to look "full" (total >= 3) while holding
// almost no domestic news, starving Need To Know.
describe('selectNeedToKnowWindow', () => {
  const el = { ok: true }
  const no = { ok: false }
  const isEl = (x: { ok: boolean }) => x.ok

  it('keeps the tight window when it has enough eligible stories', () => {
    const w = [el, el, el, el, el, no]
    const f = [...w, el, el]
    expect(selectNeedToKnowWindow(w, f, isEl, 5)).toBe(w)
  })

  it('falls back when the tight window is thin on ELIGIBLE stories despite being full', () => {
    const w = [el, el, no, no, no, no, no, no] // 8 total, only 2 eligible
    const f = [el, el, el, el, el, el]
    expect(selectNeedToKnowWindow(w, f, isEl, 5)).toBe(f)
  })

  it('boundary: exactly the minimum keeps the tight window', () => {
    const w = [el, el, el, el, el]
    const f = [el, el, el, el, el, el]
    expect(selectNeedToKnowWindow(w, f, isEl, 5)).toBe(w)
  })
})
