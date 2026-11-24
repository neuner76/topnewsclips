import { describe, expect, it } from 'vitest'
import { needsDigestRecovery, DIGEST_RECOVERY_GUARD_HOUR_UTC } from './digest-watchdog'

// The watchdog runs after the day's ingest+digest window and asks: did today's
// digest actually land? GitHub silently drops scheduled ingest triggers, and the
// digest is chained to ingest, so a dropped trigger means no digest and no email
// (observed 2026-08-31). getLatestDigest returns the newest digest with date <=
// today; if that date is today we're covered, otherwise recover. Dates are
// YYYY-MM-DD strings, so lexical comparison is chronological.
//
// A guard hour (UTC) gates recovery so it can only fire once the edition is
// genuinely overdue. `now` is injected in tests; it defaults to the real clock.
// Each "recover" case is pinned past the guard so the date logic is what's tested.
const afterGuard = (day: string) => new Date(`${day}T${String(DIGEST_RECOVERY_GUARD_HOUR_UTC).padStart(2, '0')}:30:00Z`)

describe('needsDigestRecovery — date logic', () => {
  it('does not recover when a digest already exists for today', () => {
    expect(needsDigestRecovery('2026-08-31', '2026-08-31', afterGuard('2026-08-31'))).toBe(false)
  })

  it('recovers when the latest digest is from a previous day (past the guard hour)', () => {
    expect(needsDigestRecovery('2026-08-30', '2026-08-31', afterGuard('2026-08-31'))).toBe(true)
  })

  it('recovers when there is no digest at all (past the guard hour)', () => {
    expect(needsDigestRecovery(null, '2026-08-31', afterGuard('2026-08-31'))).toBe(true)
    expect(needsDigestRecovery(undefined, '2026-08-31', afterGuard('2026-08-31'))).toBe(true)
  })

  it('does not recover when a digest is somehow dated ahead (never trigger on a future row)', () => {
    expect(needsDigestRecovery('2026-09-01', '2026-08-31', afterGuard('2026-08-31'))).toBe(false)
  })
})

// The edition sends ~12:00 UTC. A watchdog run before that window sees "yesterday's
// digest is the latest" — which is NORMAL (not-yet-due), not a dropped ingest.
// Without a time guard the watchdog "recovered" a digest that wasn't missing and
// shipped it ~6.5h early (observed 2026-11-24: a watchdog run at 05:06 UTC, just
// past midnight ET, regenerated the edition because the NY date had rolled over).
describe('needsDigestRecovery — time guard against the early-send false positive', () => {
  it('does NOT recover before the guard hour even when yesterday is the latest (the 05:06 UTC case)', () => {
    const at0506 = new Date('2026-11-24T05:06:00Z')
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', at0506)).toBe(false)
  })

  it('does NOT recover before the guard hour even when no digest exists at all', () => {
    expect(needsDigestRecovery(null, '2026-11-24', new Date('2026-11-24T05:06:00Z'))).toBe(false)
  })

  it('does NOT recover one minute before the guard hour', () => {
    const justBefore = new Date(`2026-11-24T${String(DIGEST_RECOVERY_GUARD_HOUR_UTC - 1).padStart(2, '0')}:59:00Z`)
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', justBefore)).toBe(false)
  })

  it('recovers at the guard hour when the edition is genuinely overdue', () => {
    const atGuard = new Date(`2026-11-24T${String(DIGEST_RECOVERY_GUARD_HOUR_UTC).padStart(2, '0')}:00:00Z`)
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', atGuard)).toBe(true)
  })

  it('still recovers late in the day (a genuinely dropped edition)', () => {
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', new Date('2026-11-24T21:00:00Z'))).toBe(true)
  })

  it('honors a custom guard hour', () => {
    const at1000 = new Date('2026-11-24T10:00:00Z')
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', at1000, 9)).toBe(true)
    expect(needsDigestRecovery('2026-11-23', '2026-11-24', at1000, 11)).toBe(false)
  })
})
