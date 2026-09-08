// Build A event dedup: merge two events with the same eventType whose points are
// within 0.5 mi and whose firstSeenAt are within 6 h. Merged events keep the
// earliest firstSeenAt and union their sources. Smarter clustering is Build C.
import type { LocalEvent } from './types'
import { haversineMiles } from './geography'

const MERGE_RADIUS_MILES = 0.5
const MERGE_WINDOW_HOURS = 6

function isSameLocalIncident(a: LocalEvent, b: LocalEvent): boolean {
  if (a.eventType !== b.eventType) return false
  const aLat = a.geo.latitude, aLng = a.geo.longitude, bLat = b.geo.latitude, bLng = b.geo.longitude
  if (aLat == null || aLng == null || bLat == null || bLng == null) return false
  if (haversineMiles(aLat, aLng, bLat, bLng) > MERGE_RADIUS_MILES) return false
  const hoursApart = Math.abs(new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime()) / 3_600_000
  return hoursApart <= MERGE_WINDOW_HOURS
}

function unionSources(a: LocalEvent['sources'], b: LocalEvent['sources']): LocalEvent['sources'] {
  const seen = new Set(a.map(s => `${s.type}|${s.label}`))
  return [...a, ...b.filter(s => !seen.has(`${s.type}|${s.label}`))]
}

export function mergeLocalEvents(events: LocalEvent[]): LocalEvent[] {
  const merged: LocalEvent[] = []
  for (const e of events) {
    const match = merged.find(m => isSameLocalIncident(m, e))
    if (!match) {
      merged.push({ ...e, sources: [...e.sources] })
      continue
    }
    // Keep the earliest firstSeenAt; latest update; union sources; max consequence.
    if (new Date(e.firstSeenAt).getTime() < new Date(match.firstSeenAt).getTime()) match.firstSeenAt = e.firstSeenAt
    if (new Date(e.latestUpdateAt).getTime() > new Date(match.latestUpdateAt).getTime()) match.latestUpdateAt = e.latestUpdateAt
    match.sources = unionSources(match.sources, e.sources)
    match.consequenceScore = Math.max(match.consequenceScore, e.consequenceScore)
  }
  return merged
}
