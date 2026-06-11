import { describe, it, expect } from 'vitest'
import { isFresh } from './pipeline'

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
