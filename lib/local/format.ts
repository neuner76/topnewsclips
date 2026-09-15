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
