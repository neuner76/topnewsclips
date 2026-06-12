import { describe, expect, it } from 'vitest'

import { getSourceTier } from './source-tier'

describe('source tier lookup', () => {
  it('classifies TRT World handles as state media', () => {
    expect(getSourceTier('trtworld', 'YouTube/TRT World', 'reported')).toEqual({
      tier: 8,
      sourceType: 'State Media',
    })
  })

  it('classifies TRT World YouTube sources as state media', () => {
    expect(getSourceTier(null, 'YouTube/TRT World', 'reported')).toEqual({
      tier: 8,
      sourceType: 'State Media',
    })
  })

  // Tier follows the publisher of record, never the distribution platform
  it('resolves an official newsroom TikTok account to the publisher tier', () => {
    expect(getSourceTier(null, 'TikTok/@60minutes', 'reported')).toEqual({
      tier: 6,
      sourceType: 'Newsroom',
    })
    expect(getSourceTier(null, 'TikTok/@abcnews', 'reported')).toEqual({
      tier: 6,
      sourceType: 'Newsroom',
    })
  })

  it('resolves a public broadcaster TikTok account to Tier 3', () => {
    expect(getSourceTier(null, 'TikTok/@dwnews', 'reported')).toEqual({
      tier: 3,
      sourceType: 'Public Broadcaster',
    })
  })

  it('keeps genuinely community TikTok accounts at Tier 10 (or 9 for raw)', () => {
    expect(getSourceTier(null, 'TikTok/@the_sabali', 'reported')).toEqual({
      tier: 10,
      sourceType: 'Community Sourced',
    })
    expect(getSourceTier(null, 'TikTok/@random_bystander', 'raw')).toEqual({
      tier: 9,
      sourceType: 'Raw Footage',
    })
  })
})
