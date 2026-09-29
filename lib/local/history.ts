import type { LocalEvent } from './types'
import type { ResolutionReason } from './ingest/resolution'

export type ResolutionKind = ResolutionReason

export interface HistorySectionDef {
  key: string
  label: string
  icon: string
  accent: string
  eventTypes: string[]
}

// Ordered; mirrors LocalDigestView identity/accents. Air Quality/Development and
// Fire/Safety intentionally share accents (icons distinguish them), per spec §6.
export const HISTORY_SECTIONS: HistorySectionDef[] = [
  { key: 'roads', label: 'Roads & Incidents', icon: '🚧', accent: '#EA580C', eventTypes: ['road_closure', 'road_incident', 'transit_disruption'] },
  { key: 'fire', label: 'Fire', icon: '🔥', accent: '#DC2626', eventTypes: ['fire_incident', 'fire_detection'] },
  { key: 'weather', label: 'Weather & Water', icon: '🌊', accent: '#0F766E', eventTypes: ['weather_alert', 'coastal_flood', 'stream_high_water', 'reservoir_change'] },
  { key: 'air', label: 'Air Quality', icon: '🌲', accent: '#16A34A', eventTypes: ['air_quality'] },
  { key: 'utilities', label: 'Utilities', icon: '⚡', accent: '#CA8A04', eventTypes: ['power_outage'] },
  { key: 'development', label: 'Development', icon: '🏗️', accent: '#16A34A', eventTypes: ['development_update'] },
  { key: 'government', label: 'Government', icon: '🏛️', accent: '#2563EB', eventTypes: ['government_action'] },
  { key: 'safety', label: 'Safety', icon: '🚨', accent: '#DC2626', eventTypes: ['public_safety'] },
]

// Roads with few alternatives — a long closure here is kept as an individual row
// (spec §5), matched as a case-insensitive substring of the event title.
export const ROUTINE_CLOSURE_ROADS_EXEMPT = ['SR-1', 'Sir Francis Drake', 'Lucas Valley', 'Point Reyes-Petaluma', 'Point Reyes Petaluma']

const TYPE_TO_SECTION: Record<string, string> = Object.fromEntries(
  HISTORY_SECTIONS.flatMap(s => s.eventTypes.map(t => [t, s.key])),
)

export function sectionForType(specEventType: string): string | undefined {
  return TYPE_TO_SECTION[specEventType]
}

// A concluded event prepared for the history UI.
export interface HistoryEvent {
  event: LocalEvent          // display fields (title, sources, summary, app eventType)
  specEventType: string      // raw local_events.event_type — used for section bucketing
  startedAt?: string         // local_events.first_seen_at (source-provided start)
  firstDetectedAt?: string   // local_events.first_detected_at
  resolvedAt?: string        // local_events.resolved_at
  latestUpdateAt?: string    // local_events.latest_update_at (raw)
  resolutionKind: ResolutionKind
  correctionCount: number
  verificationLabel: string
}

export interface HistorySectionView {
  def: HistorySectionDef
  events: HistoryEvent[]
}
