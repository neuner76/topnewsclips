import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalEvent } from './types'
import type { ResolutionReason } from './ingest/resolution'
import { mapStoredEventToLocalEvent, readSourcesByEvent, type StoredEventRow } from './store-read'

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

interface HistoryRow extends StoredEventRow {
  event_type: string
  first_detected_at: string | null
  resolved_at: string | null
  verification_status: string | null
  latest_update_at: string
  first_seen_at: string
}

const SELECT_COLS =
  'id, title, headline, event_type, status, first_seen_at, first_detected_at, latest_update_at, resolved_at, verification_status, geo, consequence_score, confidence, summary, why_it_matters, what_changed, importance, last_seen_at'

const ROADS_FETCH_LIMIT = 500 // fetch the 30-day road window, then partition routine vs not in code

async function fetchSection(sb: SupabaseClient, eventTypes: string[], sinceIso: string, limit: number): Promise<HistoryRow[]> {
  const { data, error } = await sb
    .from('local_events')
    .select(SELECT_COLS)
    .eq('publish_state', 'published')
    .in('lifecycle_state', ['resolved', 'archived'])
    .in('event_type', eventTypes)
    .gte('resolved_at', sinceIso) // resolved_at is set on every resolution (absence + sweep)
    .order('resolved_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`history ${eventTypes.join(',')}: ${error.message}`)
  return (data ?? []) as HistoryRow[]
}

async function resolutionReasons(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, string | null>> {
  const m = new Map<string, string | null>()
  if (eventIds.length === 0) return m
  const { data } = await sb
    .from('local_event_update')
    .select('event_id, at, new_value')
    .eq('kind', 'resolved')
    .in('event_id', eventIds)
    .order('at', { ascending: false })
  for (const r of (data ?? []) as Array<{ event_id: string; new_value: { reason?: string } | null }>) {
    if (!m.has(r.event_id)) m.set(r.event_id, r.new_value?.reason ?? null) // first = most recent
  }
  return m
}

async function correctionCounts(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (eventIds.length === 0) return m
  const { data } = await sb.from('local_event_update').select('event_id').eq('kind', 'correction').in('event_id', eventIds)
  for (const r of (data ?? []) as Array<{ event_id: string }>) m.set(r.event_id, (m.get(r.event_id) ?? 0) + 1)
  return m
}

function toHistoryEvent(
  row: HistoryRow,
  sources: Parameters<typeof mapStoredEventToLocalEvent>[1],
  reason: string | null | undefined,
  correctionCount: number,
): HistoryEvent {
  return {
    event: mapStoredEventToLocalEvent(row, sources),
    specEventType: row.event_type,
    startedAt: row.first_seen_at ?? undefined,     // source-provided start (see reconciliation note)
    firstDetectedAt: row.first_detected_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    latestUpdateAt: row.latest_update_at ?? undefined,
    resolutionKind: inferResolutionKind({ resolvedAt: row.resolved_at ?? undefined, latestUpdateAt: row.latest_update_at ?? undefined, reason }),
    correctionCount,
    verificationLabel: verificationLabel(row.verification_status),
  }
}

export interface EventHistory {
  sections: HistorySectionView[]
  routineSummary?: string
}

export async function readEventHistory(sb: SupabaseClient, opts: { sinceDays?: number; perSectionLimit?: number } = {}): Promise<EventHistory> {
  const sinceDays = opts.sinceDays ?? 30
  const perSectionLimit = opts.perSectionLimit ?? 15
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const now = new Date()

  const roadsDef = HISTORY_SECTIONS.find(s => s.key === 'roads')!
  const otherDefs = HISTORY_SECTIONS.filter(s => s.key !== 'roads')

  // One query per section in parallel (Roads pulls a wider window to partition).
  const [roadRows, ...otherRows] = await Promise.all([
    fetchSection(sb, roadsDef.eventTypes, sinceIso, ROADS_FETCH_LIMIT),
    ...otherDefs.map(d => fetchSection(sb, d.eventTypes, sinceIso, perSectionLimit)),
  ])

  // Partition roads: routine road_closures → summary; everything else → rows (capped).
  const routine: HistoryRow[] = []
  const roadRowsKept: HistoryRow[] = []
  for (const r of roadRows) {
    if (isRoutineClosure({ specEventType: r.event_type, title: r.headline ?? r.title, summary: r.summary ?? undefined, startedAt: r.first_seen_at ?? undefined, resolvedAt: r.resolved_at ?? undefined })) routine.push(r)
    else roadRowsKept.push(r)
  }
  const roadTop = topRoadsByFrequency(routine.map(r => extractRoadName(r.headline ?? r.title)))
  const routineSummary = formatRoutineSummary(routine.length, roadTop)

  // Assemble the flat row set (roads capped to perSectionLimit here; others already capped by query).
  const allRows: HistoryRow[] = [...roadRowsKept.slice(0, perSectionLimit), ...otherRows.flat()]
  const ids = allRows.map(r => r.id)
  const [sources, reasons, corrections] = await Promise.all([
    readSourcesByEvent(sb, ids),
    resolutionReasons(sb, ids),
    correctionCounts(sb, ids),
  ])

  const events = allRows.map(r => toHistoryEvent(r, sources.get(r.id) ?? [], reasons.get(r.id), corrections.get(r.id) ?? 0))
  void now // formatting happens in the page with the request-time `now`
  return { sections: groupHistoryBySection(events, perSectionLimit), routineSummary }
}

function topRoadsByFrequency(names: string[]): string[] {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 3)
}
