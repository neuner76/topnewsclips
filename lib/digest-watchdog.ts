// Digest watchdog: decide whether today's digest is missing and a recovery
// ingest should be triggered. GitHub Actions silently drops scheduled ingest
// triggers, and the digest is chained to ingest (workflow_run), so a dropped
// trigger means no digest and no subscriber email with nothing failing loudly
// (observed 2026-08-31). A separate scheduled watchdog re-checks and self-heals.
//
// `latestDigestDate` is the date of the newest stored digest (getLatestDigest
// already scopes to date <= today); `today` is today's date in the newsletter's
// timezone. Both are YYYY-MM-DD, so lexical comparison is chronological.
export function needsDigestRecovery(
  latestDigestDate: string | null | undefined,
  today: string
): boolean {
  if (!latestDigestDate) return true
  return latestDigestDate < today
}
