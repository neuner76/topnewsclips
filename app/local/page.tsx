import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildMyLocalDigest, type MyLocalDigest } from '@/lib/local/digest'
import { formatFreshness } from '@/lib/local/format'
import type { LocalEvent } from '@/lib/local/types'
import type { EnvironmentSnapshot } from '@/lib/local/adapters/types'

// Owner-gated, dynamic (reads the admin session). Renders only real, live data;
// sections without a live source yet are shown as "coming soon", never faked.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Local — TopNewsClips' }

function EventCard({ e }: { e: LocalEvent }) {
  const url = e.sources.find(s => s.url)?.url
  const ts = e.latestUpdateAt || e.firstSeenAt
  const freshness = formatFreshness(ts)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-white">{e.title}{url && <span className="text-white/40"> →</span>}</div>
        {e.amountUsd != null && (
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
            ${e.amountUsd.toLocaleString()}
          </span>
        )}
      </div>
      {(e.whyItMatters || e.summary || e.whatChanged) && (
        <p className="mt-1 text-xs text-white/60">{e.whyItMatters ?? e.summary ?? e.whatChanged}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
        <span className="uppercase tracking-wide">{e.confidence} confidence</span>
        {e.sources[0] && <span>· {e.sources[0].label}</span>}
        {freshness && <span title={new Date(ts).toISOString()}>· {freshness}</span>}
      </div>
    </>
  )
  const cls = `block rounded-lg border border-white/10 p-3${url ? ' hover:border-white/30 transition-colors' : ''}`
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
    : <div className={cls}>{body}</div>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/60">{title}</h2>
}

function EventSection({ title, events, comingSoon }: { title: string; events: LocalEvent[]; comingSoon?: boolean }) {
  if (comingSoon) {
    return (
      <section className="mb-8">
        <SectionHeader title={title} />
        <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/40">
          Coming soon — this section isn’t wired to a live source yet.
        </div>
      </section>
    )
  }
  if (events.length === 0) return null // omit empty sections — never show stale/fake data
  return (
    <section className="mb-8">
      <SectionHeader title={title} />
      <div className="space-y-2">{events.map(e => <EventCard key={e.id} e={e} />)}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function EnvironmentModule({ env }: { env: EnvironmentSnapshot }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/60">
        Your Environment
        <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-white/60">data as of {formatFreshness(env.dataAsOf)}</span>
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {env.fireRisk && env.fireRisk.level !== 'unknown' && <Stat label="Fire risk" value={env.fireRisk.level} />}
        {env.wind && <Stat label="Wind" value={env.wind.text || `${env.wind.direction ?? ''} ${env.wind.speedMph ?? ''} mph`} />}
        {env.airQuality && env.airQuality.aqi > 0
          ? <Stat label="Air quality" value={`AQI ${env.airQuality.aqi} · ${env.airQuality.category}`} />
          : <Stat label="Air quality" value="Unavailable" />}
        {env.tide?.nextHigh && <Stat label="Next high tide" value={env.tide.nextHigh.time.slice(11) || env.tide.nextHigh.time} />}
        {env.tide?.nextLow && <Stat label="Next low tide" value={env.tide.nextLow.time.slice(11) || env.tide.nextLow.time} />}
        <Stat label="Thermal anomalies" value={env.thermalAnomalies ? String(env.thermalAnomalies.count) : 'None'} />
      </div>
      {env.activeAlerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {env.activeAlerts.map((a, i) => (
            <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="text-sm font-semibold text-white">{a.event}</div>
              <p className="mt-0.5 text-xs text-white/60">{a.area}</p>
            </div>
          ))}
        </div>
      )}
      {env.recentEarthquakes.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-white/60">Recent earthquakes</div>
          <ul className="mt-1 space-y-1 text-xs text-white/60">
            {env.recentEarthquakes.slice(0, 5).map((q, i) => (
              <li key={i}>M {q.magnitude} — {q.place}{q.distanceMiles != null ? ` (${Math.round(q.distanceMiles)} mi)` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default async function LocalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let digest: MyLocalDigest
  try {
    digest = await buildMyLocalDigest()
  } catch {
    return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-sm text-red-600">My Local is temporarily unavailable.</p></main>
  }

  const comingSoon = (key: string) => digest.comingSoonSections.includes(key)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">My Local</h1>
        <p className="mt-1 text-sm text-white/60">
          {digest.places.map(p => p.label).join(' · ') || 'No saved places yet'}
        </p>
        <p className="mt-1 text-xs text-white/60">What changed around you — from your block to your county.</p>
      </header>

      <EventSection title="Need To Know Near You" events={digest.needToKnow} comingSoon={comingSoon('needToKnow')} />
      <EventSection title="Changing Around You" events={digest.changingAroundYou} />
      <EventSection title="Your Government" events={digest.yourGovernment} />
      {digest.environment && <EnvironmentModule env={digest.environment} />}
      <EventSection title="Roads & Incidents" events={digest.roadsAndIncidents} comingSoon={comingSoon('roadsAndIncidents')} />
      <EventSection title="Local Reporting" events={digest.localReporting} />
      <EventSection title="Local Blindspot" events={digest.localBlindspot} />
    </main>
  )
}
