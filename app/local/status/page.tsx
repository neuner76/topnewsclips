import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { readPipelineStatus, type PipelineStatus, type SourceHealth } from '@/lib/local/status'

// Owner-gated pipeline health. Reads local_source + local_job_run so the dispatcher
// is observable: registration, last run, output, failures. Dynamic (session + live).
export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Local — Pipeline status' }

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const HEALTH_STYLE: Record<SourceHealth, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-[#DCFCE7] text-[#166534]' },
  failing: { label: 'Failing', cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  idle: { label: 'Idle', cls: 'bg-[#F1F5F9] text-[#475569]' },
  no_adapter: { label: 'No adapter', cls: 'bg-[#FEF3C7] text-[#92400E]' },
}

function when(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function StatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let status: PipelineStatus | null = null
  let error: string | null = null
  try {
    status = await readPipelineStatus(serviceClient())
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load pipeline status.'
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Pipeline status</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingestion sources, recent runs, and event-store counts. Reads live from the database.</p>
        </div>

        {error && (
          <p className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-red-700">
            {error}
            <span className="mt-1 block text-xs text-red-500">If this mentions a missing table/column, the ingest migrations (20260925/26/27) aren&apos;t applied yet.</span>
          </p>
        )}

        {status && (
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              {(['published', 'held', 'rejected'] as const).map(k => (
                <div key={k} className="rounded-lg border border-[#EFF2F6] bg-white px-4 py-3">
                  <div className="text-2xl font-black tabular-nums text-foreground">{status!.eventCounts[k]}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>

            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">Sources</h2>
            <div className="mb-8 overflow-hidden rounded-lg border border-[#EFF2F6]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAFBFC] text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Health</th>
                    <th className="px-3 py-2 font-semibold">Last run</th>
                    <th className="px-3 py-2 font-semibold">Interval</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {status.sources.map(s => {
                    const h = HEALTH_STYLE[s.health]
                    return (
                      <tr key={s.slug} className="border-t border-[#EFF2F6]">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground">{s.slug}{!s.active && ' · inactive'}</div>
                          {s.health === 'failing' && s.lastError && <div className="mt-0.5 text-[11px] text-red-600">{s.lastError}</div>}
                        </td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${h.cls}`}>{h.label}</span>{s.consecutiveFailures > 0 && <span className="ml-1 text-[11px] text-red-600">×{s.consecutiveFailures}</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{when(s.lastSuccessAt)}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.intervalSeconds}s</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.dueNow ? 'now' : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">Recent runs</h2>
            {status.recentRuns.length === 0 ? (
              <p className="rounded-lg border border-[#EFF2F6] bg-[#FAFBFC] px-4 py-6 text-center text-sm text-muted-foreground">No runs recorded yet — the dispatcher hasn&apos;t fired.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#EFF2F6]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAFBFC] text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Items (new)</th>
                      <th className="px-3 py-2 font-semibold">Events (+/~)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.recentRuns.map((r, i) => (
                      <tr key={i} className="border-t border-[#EFF2F6]">
                        <td className="px-3 py-2 text-foreground">{r.slug}</td>
                        <td className="px-3 py-2 text-muted-foreground">{when(r.startedAt)}</td>
                        <td className="px-3 py-2">{r.status === 'ok' ? <span className="text-[#166534]">ok</span> : <span className="text-red-600">{r.status ?? '—'}</span>}{r.error && <div className="text-[11px] text-red-600">{r.error}</div>}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.itemsFetched} ({r.itemsNew})</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">+{r.eventsCreated} ~{r.eventsUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
