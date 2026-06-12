import { describe, expect, it } from 'vitest'

import {
  fallbackSectionTitle,
  isSoftNeedToKnowStory,
  needToKnowPriorityScore,
  normalizeDigestContent,
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
