// Human freshness label for a card's timestamp, so readers can see how current
// each item is. Recent past -> "20m ago" / "3h ago" / "3d ago"; anything 7+ days
// old, or a future date (e.g. an upcoming meeting), falls back to an absolute
// "Mon D" date rather than a misleading relative phrase.
export function formatFreshness(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (diffMs >= 0 && mins < 1) return 'just now'
  if (diffMs >= 0 && mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (diffMs >= 0 && hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (diffMs >= 0 && days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Forward-looking stamp for scheduled items (e.g. a Caltrans closure that hasn't
// started yet). Returns '' when the time is now/past — callers fall back to
// formatFreshness. Near-term is relative ("starts in 3h"); further out is an
// absolute Pacific day+time ("starts Sat 7:00 AM").
export function formatSchedule(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diffMs = t - now
  if (diffMs <= 0) return ''
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `starts in ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 18) return `starts in ${hrs}h`
  return 'starts ' + new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}
