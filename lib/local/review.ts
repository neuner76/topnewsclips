import type { SupabaseClient } from '@supabase/supabase-js'
import { appEventType } from './store-read'
import type { LocalEventType } from './types'

// Held-event review model. Events whose event_type has auto_publish=false (e.g.
// development_update, government_action) land publish_state='held' and surface here
// for a human to publish or reject. Pure mapping is tested; the DB read/write are
// thin wrappers. Writes use the service client (RLS bypass) AFTER an admin session
// is verified by the route.

export type ReviewAction = 'publish' | 'reject'

export interface HeldEventSource {
  label: string
  url?: string
}

export interface HeldEventView {
  id: string
  headline: string
  eventTypeSlug: string
  appType: LocalEventType
  typeLabel: string
  importance: number
  verificationStatus: string | null
  geoPrecision: string | null
  publishReason: string | null
  firstDetectedAt: string | null
  summary?: string
  sources: HeldEventSource[]
}

export interface HeldEventRow {
  id: string
  headline: string | null
  title: string
  event_type: string
  importance: number | null
  verification_status: string | null
  geo_precision: string | null
  publish_reason: string | null
  first_detected_at: string | null
  summary: string | null
}

// spec slug → a human label (e.g. "development_update" → "Development update").
export function prettyTypeLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function mapHeldEvent(row: HeldEventRow, sources: HeldEventSource[] = []): HeldEventView {
  return {
    id: row.id,
    headline: row.headline ?? row.title,
    eventTypeSlug: row.event_type,
    appType: appEventType(row.event_type),
    typeLabel: prettyTypeLabel(row.event_type),
    importance: row.importance ?? 0,
    verificationStatus: row.verification_status,
    geoPrecision: row.geo_precision,
    publishReason: row.publish_reason,
    firstDetectedAt: row.first_detected_at,
    summary: row.summary ?? undefined,
    sources,
  }
}

interface EventSourceJoinRow {
  event_id: string
  local_source_item: {
    url: string | null
    title: string | null
    local_source: { name: string | null } | null
  } | null
}

export async function readHeldEvents(sb: SupabaseClient, opts: { limit?: number } = {}): Promise<HeldEventView[]> {
  const { data, error } = await sb
    .from('local_events')
    .select('id, headline, title, event_type, importance, verification_status, geo_precision, publish_reason, first_detected_at, summary')
    .eq('publish_state', 'held')
    .eq('lifecycle_state', 'active')
    .order('importance', { ascending: false, nullsFirst: false })
    .order('first_detected_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (error) throw new Error(`readHeldEvents: ${error.message}`)
  const rows = (data ?? []) as HeldEventRow[]

  const byEvent = new Map<string, HeldEventSource[]>()
  if (rows.length > 0) {
    const { data: es } = await sb
      .from('local_event_source')
      .select('event_id, local_source_item(url, title, local_source(name))')
      .in('event_id', rows.map(r => r.id))
    for (const r of (es ?? []) as unknown as EventSourceJoinRow[]) {
      const item = r.local_source_item
      const list = byEvent.get(r.event_id) ?? []
      list.push({ label: item?.local_source?.name ?? item?.title ?? 'Source', url: item?.url ?? undefined })
      byEvent.set(r.event_id, list)
    }
  }
  return rows.map(r => mapHeldEvent(r, byEvent.get(r.id) ?? []))
}

// Publish or reject a held event. Records an audit event_update. Returns the new
// publish_state, or null if the event wasn't found / wasn't held.
export async function reviewEvent(
  sb: SupabaseClient,
  eventId: string,
  action: ReviewAction,
): Promise<'published' | 'rejected' | null> {
  const state = action === 'publish' ? 'published' : 'rejected'
  const reason = action === 'publish' ? 'manually published by reviewer' : 'rejected by reviewer'
  const now = new Date().toISOString()

  const { data, error } = await sb
    .from('local_events')
    .update({ publish_state: state, publish_reason: reason, updated_at: now })
    .eq('id', eventId)
    .eq('publish_state', 'held') // idempotent: only a currently-held event transitions
    .select('id')
  if (error) throw new Error(`reviewEvent: ${error.message}`)
  if (!data || data.length === 0) return null

  await sb.from('local_event_update').insert({
    event_id: eventId, kind: 'status_change', text: reason,
  })
  return state
}
