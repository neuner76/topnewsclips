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

export function formatActiveDuration(startIso?: string, endIso?: string, opts: { atLeast?: boolean } = {}): string | undefined {
  if (!startIso || !endIso) return undefined
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined
  const prefix = opts.atLeast ? 'active at least' : 'active'
  const totalMinutes = (end - start) / 60_000
  const roundedMinutes = Math.round(totalMinutes)
  if (roundedMinutes < 60) return `${prefix} ${roundedMinutes} min`
  const roundedHours = Math.round(totalMinutes / 60)
  if (roundedHours < 48) return `${prefix} ${roundedHours}h`
  return `${prefix} ${Math.round(totalMinutes / 1440)} days`
}

const PACIFIC_TZ = 'America/Los_Angeles'
const TIME_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function formatPacificTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const within24h = now.getTime() - t < 24 * 3_600_000 && now.getTime() - t >= 0
  // DATE_TIME_FMT yields e.g. "Sep 24, 3:40 PM"; TIME_FMT yields "12:40 PM".
  return within24h ? TIME_FMT.format(t) : DATE_TIME_FMT.format(t)
}

const SWEEP_GAP_MS = 60 * 60_000 // §4.2: latest_update → resolved ≥ 60 min ⇒ time_sweep

export function inferResolutionKind(args: { resolvedAt?: string; latestUpdateAt?: string; reason?: string | null }): ResolutionKind {
  const r = args.reason
  if (r === 'feed_absent' || r === 'explicit_end' || r === 'time_sweep') return r
  const resolved = args.resolvedAt ? Date.parse(args.resolvedAt) : NaN
  const latest = args.latestUpdateAt ? Date.parse(args.latestUpdateAt) : NaN
  if (Number.isFinite(resolved) && Number.isFinite(latest) && resolved - latest >= SWEEP_GAP_MS) return 'time_sweep'
  return 'feed_absent'
}

export function formatResolution(kind: ResolutionKind, resolvedAt?: string, latestUpdateAt?: string, now: Date = new Date()): string {
  if (kind === 'time_sweep') {
    const t = latestUpdateAt ?? resolvedAt
    return t ? `no updates after ${formatPacificTime(t, now)}` : 'resolved'
  }
  if (!resolvedAt) return 'resolved'
  const when = formatPacificTime(resolvedAt, now)
  return kind === 'explicit_end' ? `ended ${when}` : `cleared ~${when}`
}

export function verificationLabel(verificationStatus?: string | null): string {
  switch (verificationStatus) {
    case 'confirmed': return 'Confirmed'
    case 'developing': return 'Developing'
    case 'community_reports': return 'Community reports'
    default: return 'Unverified'
  }
}

export function extractRoadName(title: string): string {
  const head = title.split('—')[0].trim()
  const route = head.match(/^(US-?\d+|SR-?\d+|I-?\d+|CA-?\d+)/i)
  return route ? route[1].toUpperCase().replace(/([A-Z]+)-?(\d+)/, '$1-$2') : head
}

export interface RoutineClosureInput {
  specEventType: string
  title: string
  summary?: string
  startedAt?: string
  resolvedAt?: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// §5: routine = a planned, non-full road_closure that isn't emergency work and
// isn't a long (≥12h) closure on a low-alternative road. Full-closure detection
// reuses the live /full closure/i title convention (need-to-know.ts).
export function isRoutineClosure(e: RoutineClosureInput): boolean {
  if (e.specEventType !== 'road_closure') return false
  if (/full closure/i.test(e.title)) return false
  const text = `${e.title} ${e.summary ?? ''}`
  if (/emergenc/i.test(text)) return false
  const onExempt = ROUTINE_CLOSURE_ROADS_EXEMPT.some(r => new RegExp(`\\b${escapeRegExp(r)}\\b`, 'i').test(e.title))
  if (onExempt && e.startedAt && e.resolvedAt) {
    const hours = (Date.parse(e.resolvedAt) - Date.parse(e.startedAt)) / 3_600_000
    if (Number.isFinite(hours) && hours >= 12) return false
  }
  return true
}

export function formatRoutineSummary(count: number, topRoads: string[]): string | undefined {
  if (count <= 0) return undefined
  const noun = count === 1 ? 'closure' : 'closures'
  const base = `Plus ${count} planned lane ${noun}`
  if (count >= 3 && topRoads.length > 0) return `${base}, mostly ${topRoads.slice(0, 2).join(', ')}.`
  return `${base}.`
}

export function groupHistoryBySection(events: HistoryEvent[], perSectionLimit: number): HistorySectionView[] {
  const buckets = new Map<string, HistoryEvent[]>()
  for (const e of events) {
    const key = sectionForType(e.specEventType)
    if (!key) continue
    const list = buckets.get(key) ?? []
    if (list.length < perSectionLimit) list.push(e)
    buckets.set(key, list)
  }
  return HISTORY_SECTIONS
    .map(def => ({ def, events: buckets.get(def.key) ?? [] }))
    .filter(s => s.events.length > 0)
}
