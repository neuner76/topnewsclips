import type { SupabaseClient } from '@supabase/supabase-js'

// §7.4 time-based lifecycle — the complement to absence resolution (resolve.ts).
// Absence resolution only covers current-state feeds; this sweep handles the rest:
//   • active + stale beyond event_type.auto_resolve_after_minutes → resolved
//     (e.g. a road_incident nobody has updated in 4h),
//   • active + older than archive_after_days (backstop so event-LOG items — permits,
//     agendas, past meetings — that never resolve by absence still age out),
//   • resolved + resolved_at older than archive_after_days → archived.
// Runs once per dispatch (cheap at this scale). Pure classify is tested.

export const DEFAULT_ARCHIVE_AFTER_DAYS = 30

export type LifecycleAction = 'resolve' | 'archive' | 'keep'

export interface LifecycleTypeConfig {
  autoResolveAfterMinutes?: number | null
  archiveAfterDays: number
}

export interface LifecycleEvent {
  lifecycleState: string | null
  latestUpdateAt: string | null
  resolvedAt: string | null
}

export function classifyLifecycle(e: LifecycleEvent, cfg: LifecycleTypeConfig, now: Date = new Date()): LifecycleAction {
  const nowMs = now.getTime()
  const archiveDays = cfg.archiveAfterDays ?? DEFAULT_ARCHIVE_AFTER_DAYS

  if (e.lifecycleState === 'active') {
    const updated = e.latestUpdateAt ? Date.parse(e.latestUpdateAt) : NaN
    if (!Number.isFinite(updated)) return 'keep'
    const ageMinutes = (nowMs - updated) / 60_000
    if (cfg.autoResolveAfterMinutes != null && ageMinutes > cfg.autoResolveAfterMinutes) return 'resolve'
    if (ageMinutes / 1440 > archiveDays) return 'resolve' // backstop: nothing stays active past the archive window
    return 'keep'
  }

  if (e.lifecycleState === 'resolved') {
    const resolved = e.resolvedAt ? Date.parse(e.resolvedAt) : NaN
    if (!Number.isFinite(resolved)) return 'keep'
    if ((nowMs - resolved) / 86_400_000 > archiveDays) return 'archive'
    return 'keep'
  }

  return 'keep'
}

interface EventLifecycleRow {
  id: string
  event_type: string
  lifecycle_state: string | null
  latest_update_at: string | null
  resolved_at: string | null
}

async function loadLifecycleConfig(sb: SupabaseClient): Promise<Map<string, LifecycleTypeConfig>> {
  const { data } = await sb.from('local_event_type').select('slug, auto_resolve_after_minutes, archive_after_days')
  const m = new Map<string, LifecycleTypeConfig>()
  for (const r of (data ?? []) as Array<{ slug: string; auto_resolve_after_minutes: number | null; archive_after_days: number | null }>) {
    m.set(r.slug, { autoResolveAfterMinutes: r.auto_resolve_after_minutes, archiveAfterDays: r.archive_after_days ?? DEFAULT_ARCHIVE_AFTER_DAYS })
  }
  return m
}

export async function sweepLifecycle(sb: SupabaseClient, now: Date = new Date()): Promise<{ resolved: number; archived: number }> {
  const cfg = await loadLifecycleConfig(sb)
  const { data, error } = await sb
    .from('local_events')
    .select('id, event_type, lifecycle_state, latest_update_at, resolved_at')
    .in('lifecycle_state', ['active', 'resolved'])
    .limit(2000)
  if (error) throw new Error(`sweepLifecycle load: ${error.message}`)

  const toResolve: string[] = []
  const toArchive: string[] = []
  for (const r of (data ?? []) as EventLifecycleRow[]) {
    const typeCfg = cfg.get(r.event_type) ?? { archiveAfterDays: DEFAULT_ARCHIVE_AFTER_DAYS }
    const action = classifyLifecycle(
      { lifecycleState: r.lifecycle_state, latestUpdateAt: r.latest_update_at, resolvedAt: r.resolved_at },
      typeCfg, now,
    )
    if (action === 'resolve') toResolve.push(r.id)
    else if (action === 'archive') toArchive.push(r.id)
  }

  const nowIso = now.toISOString()
  if (toResolve.length > 0) {
    await sb.from('local_events').update({ lifecycle_state: 'resolved', status: 'resolved', resolved_at: nowIso, updated_at: nowIso }).in('id', toResolve)
    await sb.from('local_event_update').insert(toResolve.map(id => ({ event_id: id, kind: 'resolved', text: 'Aged out (no recent activity)' })))
  }
  if (toArchive.length > 0) {
    await sb.from('local_events').update({ lifecycle_state: 'archived', updated_at: nowIso }).in('id', toArchive)
  }
  return { resolved: toResolve.length, archived: toArchive.length }
}
