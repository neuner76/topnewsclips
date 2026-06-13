import { describe, expect, it } from 'vitest'

import type { DigestContent } from './digest'
import type { Story } from './types'
import { selectNewsletterNextStep } from './newsletter-next-step'

const story = (overrides: Partial<Story>): Story => ({
  id: '1',
  title: 'NASA JPL gutted by staffing cuts',
  slug: 'story-1',
  description: 'A former scientist described staffing cuts.',
  embed_url: 'https://example.com',
  platform: 'youtube',
  view_count: 0,
  share_count: 0,
  msm_gap: false,
  msm_notes: null,
  msm_outlet_coverage: { covered: [], notCovered: [] },
  published: true,
  display_order: 50,
  category: 'reported',
  subcategory: null,
  thumbnail_url: null,
  journalist_username: null,
  source: null,
  region: null,
  source_tier: 4,
  source_type: 'Independent News',
  pinned: false,
  duration: null,
  created_at: '2026-06-12T12:00:00.000Z',
  updated_at: '2026-06-12T12:00:00.000Z',
  verified_interpretation: null,
  qc_status: 'pass',
  qc_failed_checks: null,
  qc_routing_note: null,
  ...overrides,
})

const content = (slug: string): DigestContent => ({
  needToKnow: [{ sectionTitle: 'A story', slug, paragraphs: ['One', 'Two'] }],
  inTheKnow: {
    'Politics & World Affairs': [],
    'Science & Technology': [],
    'Business & Markets': [],
    'Sports, Entertainment, & Culture': [],
    'Comedy & Satire': [],
  },
  etcetera: [],
})

describe('newsletter next step', () => {
  it('selects a safe track step from a digest story', () => {
    const step = selectNewsletterNextStep(content('story-1'), new Map([['story-1', story({})]]), 'https://topnewsclips.com')
    expect(step?.heading).toBe('One useful next step')
    expect(step?.responseType).toBe('track')
    expect(step?.url).toContain('/issues/nasa-jpl')
  })

  it('omits light novelty stories', () => {
    const step = selectNewsletterNextStep(
      content('story-1'),
      new Map([['story-1', story({ title: "Singapore Botanic Gardens opens Asia's first nature trail", category: 'reported' })]]),
      'https://topnewsclips.com'
    )
    expect(step).toBeNull()
  })

  it('handles digest content with missing in-the-know categories', () => {
    const partialContent = {
      needToKnow: [{ sectionTitle: 'A story', slug: 'story-1', paragraphs: ['One', 'Two'] }],
      inTheKnow: {},
      etcetera: [],
    } as unknown as DigestContent

    const step = selectNewsletterNextStep(partialContent, new Map([['story-1', story({})]]), 'https://topnewsclips.com')
    expect(step?.url).toContain('/issues/nasa-jpl')
  })
})
