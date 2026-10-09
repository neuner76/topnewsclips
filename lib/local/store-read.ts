import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalEvent, LocalEventType, LocalEventStatus, Confidence, LocalEvidenceSource, LocalEvidenceType, GeoScope } from './types'
import { nearAnyAnchor, type Anchor } from './anchors'

// Read side of the D1 strangler: turn PUBLISHED, ACTIVE local_events rows (written
// by the §5.2 ingestion pipeline) into the LocalEvent shape the /local UI renders.
// A section flagged 'store' in lib/local/config is served from here instead of a
// live fetch. Mapping is pure + tested; the DB read is a thin wrapper around it.

// Ingestion event_type slug (local_event_type.slug) → app-facing LocalEventType.
const SPEC_TO_APP_TYPE: Record<string, LocalEventType> = {
  power_outage: 'utility',
  road_closure: 'road_closure',
  road_incident: 'traffic',
  transit_disruption: 'traffic',
  weather_alert: 'weather',
  coastal_flood: 'flood',
  stream_high_water: 'flood',
  air_quality: 'air_quality',
  reservoir_change: 'environment',
  fire_incident: 'fire',
  fire_detection: 'fire',
  public_safety: 'crime_public_safety',
  government_action: 'government_meeting',
  development_update: 'planning',
  community_report: 'other',
}

export function appEventType(specSlug: string): LocalEventType {
  return SPEC_TO_APP_TYPE[specSlug] ?? 'other'
}

// A local_events row (published columns), plus its already-fetched sources.
export interface StoredEventRow {
  id: string
  title: string
  headline: string | null
  event_type: string
  status: string | null
  first_seen_at: string
  latest_update_at: string
  last_seen_at?: string | null
  geo: unknown
  consequence_score: number | null
  confidence: string | null
  summary: string | null
  why_it_matters: string | null
  what_changed: string | null
}

const STATUS_SET = new Set<LocalEventStatus>(['new', 'developing', 'ongoing', 'resolved'])
const CONFIDENCE_SET = new Set<Confidence>(['high', 'medium', 'low'])

function asGeoScope(geo: unknown): GeoScope {
  if (geo && typeof geo === 'object' && !Array.isArray(geo)) return geo as GeoScope
  if (typeof geo === 'string') { try { return JSON.parse(geo) as GeoScope } catch { /* fall through */ } }
  return {}
}

export function mapStoredEventToLocalEvent(row: StoredEventRow, sources: LocalEvidenceSource[] = []): LocalEvent {
  const status = (row.status && STATUS_SET.has(row.status as LocalEventStatus)) ? (row.status as LocalEventStatus) : 'new'
  const confidence = (row.confidence && CONFIDENCE_SET.has(row.confidence as Confidence)) ? (row.confidence as Confidence) : 'medium'
  return {
    id: row.id,
    title: row.headline ?? row.title,
    eventType: appEventType(row.event_type),
    status,
    firstSeenAt: row.first_seen_at,
    latestUpdateAt: row.last_seen_at ?? row.latest_update_at, // freshness = last confirmed
    geo: asGeoScope(row.geo),
    consequenceScore: row.consequence_score ?? 0,
    confidence,
    sources,
    summary: row.summary ?? undefined,
    whyItMatters: row.why_it_matters ?? undefined,
    whatChanged: row.what_changed ?? undefined,
  }
}

// role/source_type → the UI evidence label. Kept minimal; official feeds dominate today.
function evidenceType(sourceType: string | null | undefined): LocalEvidenceType {
  switch (sourceType) {
    case 'official_agency': case 'utility': return 'official_alert'
    case 'public_dataset': return 'public_record'
    case 'sensor': return 'sensor'
    case 'journalism': return 'local_news'
    default: return 'community_submission'
  }
}

interface EventSourceJoinRow {
  event_id: string
  attached_at: string | null
  local_source_item: {
    url: string | null
    title: string | null
    published_at: string | null
    fetched_at: string | null
    local_source: { name: string | null; source_type: string | null } | null
  } | null
}

export async function readSourcesByEvent(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, LocalEvidenceSource[]>> {
  const byEvent = new Map<string, LocalEvidenceSource[]>()
  if (eventIds.length === 0) return byEvent
  const { data } = await sb
    .from('local_event_source')
    .select('event_id, attached_at, local_source_item(url, title, published_at, fetched_at, local_source(name, source_type))')
    .in('event_id', eventIds)
  for (const r of (data ?? []) as unknown as EventSourceJoinRow[]) {
    const item = r.local_source_item
    const src: LocalEvidenceSource = {
      type: evidenceType(item?.local_source?.source_type),
      label: item?.local_source?.name ?? item?.title ?? 'Source',
      url: item?.url ?? undefined,
      observedAt: item?.published_at ?? item?.fetched_at ?? r.attached_at ?? new Date().toISOString(),
      status: 'confirmed',
    }
    const list = byEvent.get(r.event_id) ?? []
    list.push(src)
    byEvent.set(r.event_id, list)
  }
  return byEvent
}

export interface ReadPublishedOptions {
  types?: string[] // ingestion event_type slugs; omit for all
  limit?: number
  // Town-centered views pass the saved-place anchors; an event WITH coordinates
  // is kept only when it falls inside some anchor's radius (same test the live 511 /
  // Caltrans path uses). Coordinate-less, name/county-scoped events (county-wide
  // weather, AQI) are never dropped by this point test. Omit for an unfiltered,
  // store-wide read.
  anchors?: Anchor[]
}

// Over-fetch factor when an anchor filter is active: the store is ordered by
// importance across the whole coverage area, so near-you events can sit anywhere
// in that order. Pull a generous candidate pool, filter by distance, then cap.
const ANCHOR_OVERFETCH = 8
const ANCHOR_FETCH_FLOOR = 80
const ANCHOR_FETCH_CEIL = 300

// A stored event clears the anchor filter if there are no anchors, if it has no
// point (name/county-scoped — judged by name match elsewhere, not proximity), or
// if its point is within any anchor's radius.
export function withinAnchors(geo: GeoScope, anchors?: Anchor[]): boolean {
  if (!anchors || anchors.length === 0) return true
  const { latitude, longitude } = geo
  if (latitude == null || longitude == null) return true
  return nearAnyAnchor(latitude, longitude, anchors).ok
}

// Published + active events, most important first, with their sources attached.
export async function readPublishedEvents(sb: SupabaseClient, opts: ReadPublishedOptions = {}): Promise<LocalEvent[]> {
  let q = sb
    .from('local_events')
    .select('id, title, headline, event_type, status, first_seen_at, latest_update_at, last_seen_at, geo, consequence_score, confidence, summary, why_it_matters, what_changed, importance')
    .eq('publish_state', 'published')
    .eq('lifecycle_state', 'active')
    .order('importance', { ascending: false, nullsFirst: false })
    .order('latest_update_at', { ascending: false })
  if (opts.types && opts.types.length > 0) q = q.in('event_type', opts.types)
  const anchored = !!(opts.anchors && opts.anchors.length > 0)
  if (opts.limit) {
    const fetchLimit = anchored
      ? Math.min(Math.max(opts.limit * ANCHOR_OVERFETCH, ANCHOR_FETCH_FLOOR), ANCHOR_FETCH_CEIL)
      : opts.limit
    q = q.limit(fetchLimit)
  }

  const { data, error } = await q
  if (error) throw new Error(`readPublishedEvents: ${error.message}`)
  let rows = (data ?? []) as StoredEventRow[]
  if (anchored) rows = rows.filter(r => withinAnchors(asGeoScope(r.geo), opts.anchors))
  if (opts.limit) rows = rows.slice(0, opts.limit)
  const srcMap = await readSourcesByEvent(sb, rows.map(r => r.id))
  return rows.map(r => mapStoredEventToLocalEvent(r, srcMap.get(r.id) ?? []))
}

// Section event-type groupings (which ingestion types feed which /local section).
export const STORE_ROAD_TYPES = ['road_closure', 'road_incident', 'transit_disruption']

// Roads read that leads with LIVE incidents (unplanned 511 events — accidents,
// hazards, transit disruptions) so the real-time signal isn't crowded out of the
// slot budget by scheduled Caltrans lane closures, then fills the rest with
// closures. If there are no active incidents it degrades to all closures.
export async function readRoadsStore(sb: SupabaseClient, opts: { limit?: number; incidentSlots?: number; anchors?: Anchor[] } = {}): Promise<LocalEvent[]> {
  const limit = opts.limit ?? 8
  const incidentSlots = Math.min(opts.incidentSlots ?? 4, limit)
  const incidents = await readPublishedEvents(sb, { types: ['road_incident', 'transit_disruption'], limit: incidentSlots, anchors: opts.anchors })
  const remaining = limit - incidents.length
  const closures = remaining > 0 ? await readPublishedEvents(sb, { types: ['road_closure'], limit: remaining, anchors: opts.anchors }) : []
  return [...incidents, ...closures]
}

// A road_closure earns a Need To Know slot only when it's a FULL closure (mirrors
// the live buildNeedToKnow rule); routine lane/ramp closures stay in Roads only.
export function isFullClosure(e: LocalEvent): boolean {
  return /full closure/i.test(e.title)
}

// Store arm of Need To Know. Pulls the urgent event types near the anchors, then
// keeps only FULL road closures from the road_closure type so lane/emergency work
// doesn't masquerade as "need to know" (and doesn't duplicate the Roads section).
export async function readNeedToKnowStore(sb: SupabaseClient, opts: { limit?: number; anchors?: Anchor[] } = {}): Promise<LocalEvent[]> {
  const limit = opts.limit ?? 4
  const pool = await readPublishedEvents(sb, { types: STORE_NEED_TO_KNOW_TYPES, limit: limit * 3, anchors: opts.anchors })
  const kept = pool.filter(e => e.eventType !== 'road_closure' || isFullClosure(e))
  return kept.slice(0, limit)
}
export const STORE_NEED_TO_KNOW_TYPES = [
  'weather_alert', 'coastal_flood', 'stream_high_water', 'fire_incident', 'fire_detection',
  'public_safety', 'power_outage', 'road_closure', 'air_quality',
]
