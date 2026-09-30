import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { readEventHistory, formatActiveDuration, formatResolution, HISTORY_SECTIONS, type EventHistory, type HistoryEvent, type HistorySectionDef } from '@/lib/local/history'

// Owner-gated archive of concluded (resolved/archived) published events, grouped
// by section per the event-history spec. Dynamic — reads the admin session and
// the live store via the service client.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Local — History' }

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function Row({ e, now }: { e: HistoryEvent; now: Date }) {
  const url = e.event.sources.find(s => s.url)?.url
  const isReservoir = e.specEventType === 'reservoir_change'
  const duration = isReservoir
    ? undefined
    : formatActiveDuration(e.startedAt, e.resolutionKind === 'time_sweep' ? e.latestUpdateAt : e.resolvedAt, { atLeast: e.resolutionKind === 'time_sweep' })
  const resolution = isReservoir
    ? (e.resolvedAt ? formatResolutionDate(e.resolvedAt) : undefined)
    : formatResolution(e.resolutionKind, e.resolvedAt, e.latestUpdateAt, now)
  const meta = [duration, resolution].filter(Boolean).join(' · ')
  return (
    <div className="group block border-t border-[#EFF2F6] py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-[15px] font-semibold leading-snug text-foreground">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="group-hover:text-[#2563EB]">{e.event.title} <span aria-hidden className="text-muted-foreground">→</span></a> : e.event.title}
        {e.correctionCount > 0 && <span className="ml-2 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">Corrected</span>}
      </div>
      {meta && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{meta}</p>}
      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        <span>{e.verificationLabel}</span>
        {e.event.sources[0] && <span>· {e.event.sources[0].label}</span>}
      </div>
    </div>
  )
}

// reservoir_change is a moment, not a duration: "{headline} · {date}".
function formatResolutionDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(Date.parse(iso))
}

// Icon + accented label shared by a normal section and the routine-summary-only
// fallback (Roads can have a non-empty routineSummary with zero kept rows).
function SectionEyebrow({ def }: { def: HistorySectionDef }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none">{def.icon}</span>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: def.accent }}>{def.label}</h2>
    </div>
  )
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let history: EventHistory | null = null
  let error: string | null = null
  try {
    history = await readEventHistory(serviceClient())
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load history.'
  }
  const now = new Date()

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">What has concluded around you in the last 30 days.</p>
        </div>
        {error && <p className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-red-700">{error}</p>}
        {history && history.sections.length === 0 && !history.routineSummary && !error && (
          <p className="rounded-lg border border-[#EFF2F6] bg-[#FAFBFC] px-4 py-8 text-center text-sm text-muted-foreground">No recent history yet.</p>
        )}
        {history && history.sections.map(section => (
          <section key={section.def.key} className="mb-8">
            <SectionEyebrow def={section.def} />
            <div className="rounded-lg border border-[#EFF2F6] bg-white px-4 py-2">
              {section.events.map(e => <Row key={e.event.id} e={e} now={now} />)}
            </div>
            {section.def.key === 'roads' && history!.routineSummary && (
              <p className="mt-2 text-[12px] text-muted-foreground">{history!.routineSummary}</p>
            )}
          </section>
        ))}
        {history && history.routineSummary && !history.sections.some(s => s.def.key === 'roads') && (
          <section className="mb-8">
            <SectionEyebrow def={HISTORY_SECTIONS.find(s => s.key === 'roads')!} />
            <p className="text-[12px] text-muted-foreground">{history.routineSummary}</p>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
