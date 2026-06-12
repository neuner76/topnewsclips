import { describe, it, expect } from 'vitest'
import { isFresh, isSoftAnimalStory } from './pipeline'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('A3 freshness gate', () => {
  it('T-A3.2: rejects a 30-day-old documentary in trending', () => {
    expect(isFresh({ uploadedAt: daysAgo(30), journalistUsername: null, source: 'YouTube/VICE News' })).toBe(false)
  })

  it('T-A3.3: a 10-day-old satire clip passes (satire exemption)', () => {
    expect(isFresh({ uploadedAt: daysAgo(10), journalistUsername: 'lastweektonight', source: 'YouTube/LastWeekTonight' })).toBe(true)
  })

  it('rejects a 10-day-old non-satire clip', () => {
    expect(isFresh({ uploadedAt: daysAgo(10), journalistUsername: null, source: 'YouTube/Some Channel' })).toBe(false)
  })

  it('rejects a 20-day-old satire clip (past the 14-day satire window)', () => {
    expect(isFresh({ uploadedAt: daysAgo(20), journalistUsername: 'lastweektonight', source: 'YouTube/LastWeekTonight' })).toBe(false)
  })

  it('passes a candidate with no known upload date (TikTok/Global)', () => {
    expect(isFresh({ uploadedAt: null, journalistUsername: null, source: 'TikTok/@user' })).toBe(true)
  })

  it('passes a fresh same-day clip', () => {
    expect(isFresh({ uploadedAt: daysAgo(1), journalistUsername: null, source: 'YouTube/Some Channel' })).toBe(true)
  })
})

describe('soft animal story filter', () => {
  it('filters viral animal rescues with no public-interest angle', () => {
    expect(isSoftAnimalStory(
      "Farm owner rescues injured hawk, describes bird as 'scary' after regaining strength",
      'A farm owner posted a TikTok video documenting a hawk rescue on their property.'
    )).toBe(true)
  })

  it('keeps animal stories with a public-interest angle', () => {
    expect(isSoftAnimalStory(
      'Police investigate animal cruelty charges after injured dog rescue',
      'Officials said the case led to charges and a policy review.'
    )).toBe(false)
  })
})
