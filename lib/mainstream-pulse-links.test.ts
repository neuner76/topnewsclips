import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import { isInternalTopNewsClipsUrl, validateMainstreamPulseLinks } from './mainstream-pulse-links'

describe('Mainstream Pulse link integrity (Tasks 13–14)', () => {
  it('flags an internal /story/youtube-* link as an error', () => {
    const issues = validateMainstreamPulseLinks([fixtures.mainstreamPulseInternalLinkItem])
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].message).toMatch(/external source/i)
  })

  it('passes a correct external outlet URL', () => {
    expect(validateMainstreamPulseLinks([fixtures.mainstreamPulseExternalLinkItem])).toHaveLength(0)
  })

  it('errors on a missing external URL', () => {
    const issues = validateMainstreamPulseLinks([{ headline: 'x', source: 'AP', linkMode: 'external_source' }])
    expect(issues[0].message).toMatch(/missing/i)
  })

  it('allows an internal link when explicitly marked internal_context', () => {
    const issues = validateMainstreamPulseLinks([{ headline: 'x', url: '/story/youtube-abc', linkMode: 'internal_context' }])
    expect(issues).toHaveLength(0)
  })

  it('detects internal URL shapes', () => {
    expect(isInternalTopNewsClipsUrl('/story/youtube-abc')).toBe(true)
    expect(isInternalTopNewsClipsUrl('https://topnewsclips.com/story/youtube-abc')).toBe(true)
    expect(isInternalTopNewsClipsUrl('https://apnews.com/article/abc')).toBe(false)
    expect(isInternalTopNewsClipsUrl(null)).toBe(false)
  })
})
