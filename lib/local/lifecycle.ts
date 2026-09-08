// Event lifecycle transitions (Decisions › Event lifecycle). Pure.
import type { LocalEvent, LocalEventStatus } from './types'

// Planning/government events stay live longer before auto-resolving (14d vs 7d).
const PLANNING_GOV_TYPES = new Set<LocalEvent['eventType']>([
  'planning', 'building_permit', 'government_meeting', 'government_vote', 'contract',
])

export function deriveEventStatus(event: LocalEvent, now: number = Date.now()): LocalEventStatus {
  const firstSeen = new Date(event.firstSeenAt).getTime()
  const updated = new Date(event.latestUpdateAt).getTime()
  const hoursSinceUpdate = (now - updated) / 3_600_000
  const hoursSinceFirst = (now - firstSeen) / 3_600_000
  const resolveHours = (PLANNING_GOV_TYPES.has(event.eventType) ? 14 : 7) * 24

  if (hoursSinceUpdate >= resolveHours) return 'resolved'
  if (hoursSinceUpdate > 24) return 'ongoing'
  // Updated within 24h:
  const hasOfficial = event.sources.some(s => s.type === 'official_alert')
  if (event.sources.length >= 2 || hasOfficial) return 'developing'
  if (hoursSinceFirst < 24) return 'new'
  return 'developing'
}
