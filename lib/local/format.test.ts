import { describe, expect, it } from 'vitest'
import { formatFreshness } from './format'

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
