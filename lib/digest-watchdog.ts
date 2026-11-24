// Digest watchdog: decide whether today's digest is missing and a recovery
// ingest should be triggered. GitHub Actions silently drops scheduled ingest
// triggers, and the digest is chained to ingest (workflow_run), so a dropped
// trigger means no digest and no subscriber email with nothing failing loudly
// (observed 2026-08-31). A separate scheduled watchdog re-checks and self-heals.
//
// `latestDigestDate` is the date of the newest stored digest (getLatestDigest
// already scopes to date <= today); `today` is today's date in the newsletter's
// timezone. Both are YYYY-MM-DD, so lexical comparison is chronological.

// Recovery is gated to this UTC hour and later. The daily edition sends ~12:00
// UTC, and before then "yesterday's digest is the latest" is the NORMAL
// not-yet-due state, not a dropped ingest. Without this guard the watchdog
// "recovered" a digest that wasn't missing and shipped it ~6.5h early — observed
// 2026-11-24, when GitHub cron jitter ran a watchdog at 05:06 UTC (just past
// midnight ET, so the NY `today` had already rolled over). 14:00 UTC (09:00 ET)
// sits after the ~12:00 UTC send and before the watchdog's earliest 14:30 UTC
// cron, so genuine same-morning recovery is preserved while the early false
// positive is eliminated.
export const DIGEST_RECOVERY_GUARD_HOUR_UTC = 14

export function needsDigestRecovery(
  latestDigestDate: string | null | undefined,
  today: string,
  now: Date = new Date(),
  guardHourUtc: number = DIGEST_RECOVERY_GUARD_HOUR_UTC
): boolean {
  // Never recover before the edition is genuinely overdue, regardless of when the
  // (jitter-prone) watchdog schedule actually fires.
  if (now.getUTCHours() < guardHourUtc) return false
  if (!latestDigestDate) return true
  return latestDigestDate < today
}
