import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecretOrAdminSession } from '@/lib/auth'
import { selectDueSources, type DueSourceRow } from '@/lib/local/ingest/scheduler'
import { adapterFor } from '@/lib/local/ingest/registry'
import { runSource } from '@/lib/local/ingest/pipeline'

// D4 dispatcher. Trigger every minute (Vercel Pro cron, else Supabase pg_cron +
// pg_net) with `Authorization: Bearer ${CRON_SECRET}`. Runs whichever registered
// sources are due, each with its own timeout so one slow source can't block the
// others, and logs every run to local_job_runs. Never polls via GitHub/cron-job.org.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PER_SOURCE_TIMEOUT_MS = 20_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface SourceRow extends DueSourceRow {
  id: string
  consecutive_failures: number | null
}

export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  const supabase = serviceClient()
  const { data: sources, error } = await supabase
    .from('local_source')
    .select('id, slug, active, crawl_interval_seconds, last_success_at, consecutive_failures')
    .eq('active', true)
  if (error) return NextResponse.json({ error: `load sources: ${error.message}` }, { status: 500 })

  const due = selectDueSources((sources ?? []) as SourceRow[]).filter(s => adapterFor(s.slug))

  const outcomes = await Promise.allSettled(
    due.map(async (s) => {
      const startedAt = new Date().toISOString()
      try {
        const r = await withTimeout(runSource(supabase, s, adapterFor(s.slug)!), PER_SOURCE_TIMEOUT_MS)
        await supabase.from('local_source')
          .update({ last_success_at: new Date().toISOString(), last_error: null, last_error_at: null, consecutive_failures: 0 })
          .eq('id', s.id)
        await supabase.from('local_job_run').insert({
          source_id: s.id, started_at: startedAt, finished_at: new Date().toISOString(),
          status: 'ok', items_fetched: r.itemsFetched, items_new: r.itemsNew,
        })
        return r
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await supabase.from('local_source')
          .update({ last_error: msg, last_error_at: new Date().toISOString(), consecutive_failures: (s.consecutive_failures ?? 0) + 1 })
          .eq('id', s.id)
        await supabase.from('local_job_run').insert({
          source_id: s.id, started_at: startedAt, finished_at: new Date().toISOString(), status: 'error', error: msg,
        })
        throw e
      }
    }),
  )

  const ran = outcomes.map((o, i) =>
    o.status === 'fulfilled' ? o.value : { slug: due[i].slug, error: (o.reason as Error)?.message ?? 'error' },
  )
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    due: due.map(s => s.slug),
    ran,
  })
}
