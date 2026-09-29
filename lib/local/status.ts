import type { SupabaseClient } from '@supabase/supabase-js'
import { adapterFor } from './ingest/registry'
import { selectDueSources, MIN_INTERVAL_SECONDS } from './ingest/scheduler'

// Owner-facing pipeline observability. Reads local_source + local_job_run so the
// dispatcher's behaviour is visible without a DB console: which sources are
// registered, when each last ran, what it produced, and what's currently failing.
// Pure summarizers are tested; the reads are thin wrappers.

export type SourceHealth = 'ok' | 'failing' | 'idle' | 'no_adapter'

export interface SourceStatusRow {
  slug: string
  name: string | null
  active: boolean
  crawl_interval_seconds: number | null
  last_success_at: string | null
  last_error: string | null
  last_error_at: string | null
  consecutive_failures: number | null
}

export interface SourceStatusView {
  slug: string
  name: string
  active: boolean
  hasAdapter: boolean
  health: SourceHealth
  intervalSeconds: number
  lastSuccessAt: string | null
  lastError: string | null
  consecutiveFailures: number
  dueNow: boolean
}

export function summarizeSource(row: SourceStatusRow, hasAdapter: boolean, now: Date = new Date()): SourceStatusView {
  const consecutiveFailures = row.consecutive_failures ?? 0
  let health: SourceHealth
  if (!hasAdapter) health = 'no_adapter'
  else if (consecutiveFailures > 0) health = 'failing'
  else if (row.last_success_at) health = 'ok'
  else health = 'idle'

  const dueNow = hasAdapter && row.active && selectDueSources([row], now).length > 0

  return {
    slug: row.slug,
    name: row.name ?? row.slug,
    active: row.active,
    hasAdapter,
    health,
    intervalSeconds: Math.max(row.crawl_interval_seconds ?? MIN_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS),
    lastSuccessAt: row.last_success_at,
    lastError: row.last_error,
    consecutiveFailures,
    dueNow,
  }
}

export interface JobRunView {
  slug: string
  startedAt: string
  finishedAt: string | null
  status: string | null
  itemsFetched: number
  itemsNew: number
  eventsCreated: number
  eventsUpdated: number
  error: string | null
}

export interface PipelineStatus {
  sources: SourceStatusView[]
  recentRuns: JobRunView[]
  eventCounts: { published: number; held: number; rejected: number }
}

async function countEvents(sb: SupabaseClient, publishState: string): Promise<number> {
  const { count } = await sb
    .from('local_events')
    .select('id', { count: 'exact', head: true })
    .eq('publish_state', publishState)
    .eq('lifecycle_state', 'active')
  return count ?? 0
}

export async function readPipelineStatus(sb: SupabaseClient, now: Date = new Date()): Promise<PipelineStatus> {
  const { data: sources, error: sErr } = await sb
    .from('local_source')
    .select('slug, name, active, crawl_interval_seconds, last_success_at, last_error, last_error_at, consecutive_failures')
    .order('slug')
  if (sErr) throw new Error(`readPipelineStatus sources: ${sErr.message}`)

  const summarized = (sources ?? [] as SourceStatusRow[])
    .map((r: SourceStatusRow) => summarizeSource(r, !!adapterFor(r.slug), now))

  // Recent runs, newest first, joined to the source slug.
  const { data: runs } = await sb
    .from('local_job_run')
    .select('started_at, finished_at, status, items_fetched, items_new, events_created, events_updated, error, local_source(slug)')
    .order('started_at', { ascending: false })
    .limit(40)

  const recentRuns: JobRunView[] = ((runs ?? []) as unknown as Array<{
    started_at: string; finished_at: string | null; status: string | null
    items_fetched: number | null; items_new: number | null
    events_created: number | null; events_updated: number | null
    error: string | null; local_source: { slug: string | null } | null
  }>).map(r => ({
    slug: r.local_source?.slug ?? '—',
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    itemsFetched: r.items_fetched ?? 0,
    itemsNew: r.items_new ?? 0,
    eventsCreated: r.events_created ?? 0,
    eventsUpdated: r.events_updated ?? 0,
    error: r.error,
  }))

  const [published, held, rejected] = await Promise.all([
    countEvents(sb, 'published'), countEvents(sb, 'held'), countEvents(sb, 'rejected'),
  ])

  return { sources: summarized, recentRuns, eventCounts: { published, held, rejected } }
}
