import { describe, expect, it } from 'vitest'

import { fallbackSectionTitle, normalizeDigestContent } from './digest'

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
