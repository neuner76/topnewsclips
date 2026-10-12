import { describe, expect, it } from 'vitest'
import { formatFreshness, formatSchedule } from './format'

const now = Date.parse('2026-09-15T12:00:00Z')

describe('formatFreshness', () => {
  it('returns empty string for an invalid date', () => {
    expect(formatFreshness('not-a-date', now)).toBe('')
    expect(formatFreshness('', now)).toBe('')
  })

  it('says "just now" under a minute', () => {
    expect(formatFreshness('2026-09-15T11:59:30Z', now)).toBe('just now')
  })

  it('uses minutes, hours, then days for recent past', () => {
    expect(formatFreshness('2026-09-15T11:40:00Z', now)).toBe('20m ago')
    expect(formatFreshness('2026-09-15T09:00:00Z', now)).toBe('3h ago')
    expect(formatFreshness('2026-09-12T12:00:00Z', now)).toBe('3d ago')
  })

  it('shows an absolute date for anything 7+ days old', () => {
    expect(formatFreshness('2026-09-01T12:00:00Z', now)).toMatch(/Sep 1\b/)
  })

  it('shows an absolute date for a future timestamp (upcoming meeting)', () => {
    // Not "in the future ago" nonsense — a real date.
    expect(formatFreshness('2026-09-22T12:00:00Z', now)).toMatch(/Sep 22\b/)
  })
})

describe('formatSchedule (upcoming closures)', () => {
  it('empty for now/past (caller falls back to freshness)', () => {
    expect(formatSchedule('2026-09-15T12:00:00Z', now)).toBe('')
    expect(formatSchedule('2026-09-15T11:00:00Z', now)).toBe('')
    expect(formatSchedule('bad', now)).toBe('')
  })
  it('relative minutes then hours for the near term', () => {
    expect(formatSchedule('2026-09-15T12:30:00Z', now)).toBe('starts in 30m')
    expect(formatSchedule('2026-09-15T15:00:00Z', now)).toBe('starts in 3h')
  })
  it('absolute day+time once it is far out', () => {
    expect(formatSchedule('2026-09-16T18:00:00Z', now)).toMatch(/^starts [A-Z][a-z]{2} /)
  })
})
