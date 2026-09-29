import type { SupabaseClient } from '@supabase/supabase-js'

// §7.4 event lifecycle — absence-based resolution. Current-state feeds (NWS active
// alerts, current lane closures, active fires, live 511 events) report only what is
// happening NOW. When an event's dedupe_key stops appearing in the latest fetch, it
// is over → mark it resolved so the store stops serving it as active. Event-LOG
// sources (permits, agendas) must NOT resolve by absence — a row aging out of the
// query window doesn't mean the thing ended — so this runs only for adapters that
// opt in (resolvesByAbsence).

export interface ActiveEventRef {
  id: string
  dedupe_key: string | null
}

// Pure: given the active events for a source and the dedupe_keys seen in the latest
// fetch, return the ids to resolve (present before, absent now).
export function selectResolvableEventIds(active: ActiveEventRef[], seenKeys: Set<string>): string[] {
  return active
    .filter(e => e.dedupe_key != null && !seenKeys.has(e.dedupe_key))
    .map(e => e.id)
}

// Resolve active events for `slug` whose dedupe_key wasn't seen this run. Dedupe
// keys are slug-prefixed (`<slug>:...`), so we scope by that prefix. Sets
// lifecycle_state='resolved' + status='resolved' + resolved_at, and logs a
// 'resolved' event_update. Returns the count resolved.
export async function resolveAbsentEvents(
  sb: SupabaseClient,
  slug: string,
  seenKeys: Set<string>,
): Promise<number> {
  const { data, error } = await sb
    .from('local_events')
    .select('id, dedupe_key')
    .eq('lifecycle_state', 'active')
    .like('dedupe_key', `${slug}:%`)
  if (error) throw new Error(`resolveAbsentEvents load: ${error.message}`)

  const ids = selectResolvableEventIds((data ?? []) as ActiveEventRef[], seenKeys)
  if (ids.length === 0) return 0

  const now = new Date().toISOString()
  const { error: updErr } = await sb
    .from('local_events')
    .update({ lifecycle_state: 'resolved', status: 'resolved', resolved_at: now, updated_at: now })
    .in('id', ids)
  if (updErr) throw new Error(`resolveAbsentEvents update: ${updErr.message}`)

  await sb.from('local_event_update').insert(
    ids.map(id => ({ event_id: id, kind: 'resolved', text: 'No longer present in the source feed' })),
  )
  return ids.length
}
