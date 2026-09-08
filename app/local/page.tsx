import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildMyLocalDigest, type MyLocalDigest } from '@/lib/local/digest'
import type { LocalEvent } from '@/lib/local/types'
import type { EnvironmentSnapshot } from '@/lib/local/adapters/types'

// Owner-gated, dynamic (reads the admin session). Renders the live Your
// Environment module plus fixture-backed sections (badged) in the spec's order.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Local — TopNewsClips' }

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400">{children}</span>
}

function EventCard({ e }: { e: LocalEvent }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-sm font-semibold">{e.title}</div>
      {(e.whyItMatters || e.summary || e.whatChanged) && (
        <p className="mt-1 text-xs text-muted-foreground">{e.whyItMatters ?? e.summary ?? e.whatChanged}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{e.confidence} confidence</span>
        {e.sources[0] && <span>· {e.sources[0].label}</span>}
      </div>
    </div>
  )
}

function EventSection({ title, events, fixture }: { title: string; events: LocalEvent[]; fixture: boolean }) {
  if (events.length === 0) return null // omit empty sections
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}{fixture && <Badge>fixture</Badge>}
      </h2>
      <div className="space-y-2">{events.map(e => <EventCard key={e.id} e={e} />)}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

function EnvironmentModule({ env }: { env: EnvironmentSnapshot }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Your Environment
        <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">data as of {timeAgo(env.dataAsOf)}</span>
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {env.fireRisk && env.fireRisk.level !== 'unknown' && <Stat label="Fire risk" value={env.fireRisk.level} />}
        {env.wind && <Stat label="Wind" value={env.wind.text || `${env.wind.direction ?? ''} ${env.wind.speedMph ?? ''} mph`} />}
        {env.airQuality ? <Stat label="Air quality" value={`AQI ${env.airQuality.aqi} · ${env.airQuality.category}`} /> : <Stat label="Air quality" value="—" />}
        {env.tide?.nextHigh && <Stat label="Next high tide" value={env.tide.nextHigh.time.slice(11) || env.tide.nextHigh.time} />}
        {env.tide?.nextLow && <Stat label="Next low tide" value={env.tide.nextLow.time.slice(11) || env.tide.nextLow.time} />}
        <Stat label="Thermal anomalies" value={env.thermalAnomalies ? String(env.thermalAnomalies.count) : 'None'} />
      </div>
      {env.activeAlerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {env.activeAlerts.map((a, i) => (
            <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="text-sm font-semibold">{a.event}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.area}</p>
            </div>
          ))}
        </div>
      )}
      {env.recentEarthquakes.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent earthquakes</div>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
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

  const fx = (key: string) => digest.fixtureSections.includes(key)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 text-foreground">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">My Local</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {digest.places.map(p => p.label).join(' · ') || 'No saved places yet'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">What changed around you — from your block to your county.</p>
      </header>

      <EventSection title="Need To Know Near You" events={digest.needToKnow} fixture={fx('needToKnow')} />
      <EventSection title="Changing Around You" events={digest.changingAroundYou} fixture={fx('changingAroundYou')} />
      <EventSection title="Your Government" events={digest.yourGovernment} fixture={fx('yourGovernment')} />
      {digest.environment && <EnvironmentModule env={digest.environment} />}
      <EventSection title="Roads & Incidents" events={digest.roadsAndIncidents} fixture={fx('roadsAndIncidents')} />
      <EventSection title="Local Reporting" events={digest.localReporting} fixture={fx('localReporting')} />
      <EventSection title="Local Blindspot" events={digest.localBlindspot} fixture={fx('localBlindspot')} />
    </main>
  )
}
