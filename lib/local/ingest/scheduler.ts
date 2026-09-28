// Which sources are due to run (D4). The dispatcher fires every minute and runs
// whatever's due, computed from crawl_interval_seconds + last_success_at. The
// minimum interval is 5 min (D4), enforced here regardless of a source's config.

export const MIN_INTERVAL_SECONDS = 300 // D4

export interface DueSourceRow {
  slug: string
  active: boolean
  crawl_interval_seconds: number | null
  last_success_at: string | null
}

export function selectDueSources<T extends DueSourceRow>(sources: T[], now: Date = new Date()): T[] {
  const nowMs = now.getTime()
  return sources.filter(s => {
    if (!s.active) return false
    const interval = Math.max(s.crawl_interval_seconds ?? MIN_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS)
    if (!s.last_success_at) return true // never run
    const last = new Date(s.last_success_at).getTime()
    if (!Number.isFinite(last)) return true
    return nowMs - last >= interval * 1000
  })
}
