import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalEvent, LocalEventType, LocalEventStatus, Confidence, LocalEvidenceSource, LocalEvidenceType, GeoScope } from './types'

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

async function sourcesByEvent(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, LocalEvidenceSource[]>> {
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
  if (opts.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) throw new Error(`readPublishedEvents: ${error.message}`)
  const rows = (data ?? []) as StoredEventRow[]
  const srcMap = await sourcesByEvent(sb, rows.map(r => r.id))
  return rows.map(r => mapStoredEventToLocalEvent(r, srcMap.get(r.id) ?? []))
}

// Section event-type groupings (which ingestion types feed which /local section).
export const STORE_ROAD_TYPES = ['road_closure', 'road_incident', 'transit_disruption']
export const STORE_NEED_TO_KNOW_TYPES = [
  'weather_alert', 'coastal_flood', 'stream_high_water', 'fire_incident',
  'public_safety', 'power_outage', 'road_closure', 'air_quality',
]
