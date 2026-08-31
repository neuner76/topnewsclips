import { describe, expect, it } from 'vitest'
import { needsDigestRecovery } from './digest-watchdog'

// The watchdog runs after the day's ingest+digest window and asks: did today's
// digest actually land? GitHub silently drops scheduled ingest triggers, and the
// digest is chained to ingest, so a dropped trigger means no digest and no email
// (observed 2026-08-31). getLatestDigest returns the newest digest with date <=
// today; if that date is today we're covered, otherwise recover. Dates are
// YYYY-MM-DD strings, so lexical comparison is chronological.
describe('needsDigestRecovery', () => {
  it('does not recover when a digest already exists for today', () => {
    expect(needsDigestRecovery('2026-08-31', '2026-08-31')).toBe(false)
  })

  it('recovers when the latest digest is from a previous day', () => {
    expect(needsDigestRecovery('2026-08-30', '2026-08-31')).toBe(true)
  })

  it('recovers when there is no digest at all', () => {
    expect(needsDigestRecovery(null, '2026-08-31')).toBe(true)
    expect(needsDigestRecovery(undefined, '2026-08-31')).toBe(true)
  })

  it('does not recover when a digest is somehow dated ahead (never trigger on a future row)', () => {
    expect(needsDigestRecovery('2026-09-01', '2026-08-31')).toBe(false)
  })
})
