import { formatFreshness } from '@/lib/local/format'
import type { MyLocalDigest } from '@/lib/local/digest'
import type { LocalEvent } from '@/lib/local/types'
import type { EnvironmentSnapshot } from '@/lib/local/adapters/types'
import type { ReactNode } from 'react'

function EventCard({ e }: { e: LocalEvent }) {
  const url = e.sources.find(s => s.url)?.url
  const ts = e.latestUpdateAt || e.firstSeenAt
  const freshness = formatFreshness(ts)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">{e.title}{url && <span className="text-muted-foreground"> →</span>}</div>
        {e.amountUsd != null && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
            ${e.amountUsd.toLocaleString()}
          </span>
        )}
      </div>
      {(e.whyItMatters || e.summary || e.whatChanged) && (
        <p className="mt-1 text-xs text-muted-foreground">{e.whyItMatters ?? e.summary ?? e.whatChanged}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{e.confidence} confidence</span>
        {e.sources[0] && <span>· {e.sources[0].label}</span>}
        {freshness && <span title={new Date(ts).toISOString()}>· {freshness}</span>}
      </div>
    </>
  )
  const cls = `block rounded-lg border border-border p-3${url ? ' hover:border-foreground/30 transition-colors' : ''}`
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
    : <div className={cls}>{body}</div>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
}

function EventSection({ title, events, comingSoon }: { title: string; events: LocalEvent[]; comingSoon?: boolean }) {
  if (comingSoon) {
    return (
      <section className="mb-8">
        <SectionHeader title={title} />
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
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

// Need To Know is the urgent, act-now subset. When there's nothing urgent we
// show a positive "all clear" — an empty section here means the check ran and
// found nothing, which is itself reassuring information (not "coming soon").
function NeedToKnowSection({ events }: { events: LocalEvent[] }) {
  return (
    <section className="mb-8">
      <SectionHeader title="Need To Know Near You" />
      {events.length === 0 ? (
        <div className="rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-xs text-[#166534]">
          ✓ Nothing urgent near you right now — no active weather alerts, wildfires, nearby earthquakes, fire detections, or full road closures.
        </div>
      ) : (
        <div className="space-y-2">{events.map(e => <EventCard key={e.id} e={e} />)}</div>
      )}
    </section>
  )
}

function CameraSection({ cameras }: { cameras: MyLocalDigest['trafficCameras'] }) {
  if (!cameras || cameras.length === 0) return null
  return (
    <section className="mb-8">
      <SectionHeader title="Traffic Cameras" />
      <div className="grid grid-cols-2 gap-2">
        {cameras.map(cam => (
          <a
            key={cam.id}
            href={cam.streamUrl || cam.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-border hover:border-foreground/30 transition-colors"
          >
            {/* Live Caltrans snapshot (~5-min refresh). Plain img on purpose — do
                not let next/image cache a stale frame of a live camera. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cam.imageUrl} alt={cam.label} loading="lazy" className="aspect-video w-full bg-muted object-cover" />
            <div className="truncate p-2 text-[11px] text-muted-foreground">
              {cam.route && <span className="font-semibold text-foreground">{cam.route}</span>}
              {cam.route && cam.label ? ' · ' : ''}{cam.label}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}{href && <span aria-hidden className="text-muted-foreground"> ↗</span>}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </>
  )
  const cls = 'rounded-lg border border-border p-3'
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} block hover:border-foreground/30 transition-colors`}>{inner}</a>
    : <div className={cls}>{inner}</div>
}

function EnvironmentModule({ env }: { env: EnvironmentSnapshot }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Your Environment
        <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">data as of {formatFreshness(env.dataAsOf)}</span>
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {env.fireRisk && env.fireRisk.level !== 'unknown' && <Stat label="Fire risk" value={env.fireRisk.level} href={env.sources?.fireRisk} />}
        {env.wind && <Stat label="Wind" value={env.wind.text || `${env.wind.direction ?? ''} ${env.wind.speedMph ?? ''} mph`} href={env.sources?.wind} />}
        {env.airQuality && env.airQuality.aqi > 0
          ? <Stat label={`Air quality${env.airQuality.source ? ` · ${env.airQuality.source}` : ''}`} value={`AQI ${env.airQuality.aqi} · ${env.airQuality.category}`} href={env.sources?.airQuality} />
          : <Stat label="Air quality" value="Unavailable" href={env.sources?.airQuality} />}
        {env.tide?.nextHigh && <Stat label="Next high tide" value={env.tide.nextHigh.time.slice(11) || env.tide.nextHigh.time} href={env.sources?.tide} />}
        {env.tide?.nextLow && <Stat label="Next low tide" value={env.tide.nextLow.time.slice(11) || env.tide.nextLow.time} href={env.sources?.tide} />}
        <Stat
          label="Active fire detections"
          value={
            env.thermalAnomalies && env.thermalAnomalies.count > 0
              ? `${env.thermalAnomalies.count}${env.thermalAnomalies.nearestMiles != null ? ` · nearest ~${env.thermalAnomalies.nearestMiles} mi` : ''}`
              : 'None nearby'
          }
          href={env.sources?.thermalAnomalies}
        />
      </div>
      {env.activeAlerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {env.activeAlerts.map((a, i) => {
            const body = (
              <>
                <div className="text-sm font-semibold text-foreground">{a.event}{env.sources?.alerts && <span aria-hidden className="text-muted-foreground"> ↗</span>}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.area}</p>
              </>
            )
            const cls = 'block rounded-lg border border-red-500/20 bg-red-500/5 p-3'
            return env.sources?.alerts
              ? <a key={i} href={env.sources.alerts} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-red-500/40 transition-colors`}>{body}</a>
              : <div key={i} className={cls}>{body}</div>
          })}
        </div>
      )}
      {env.recentEarthquakes.length > 0 && (
        <div className="mt-3">
          {env.sources?.earthquakes ? (
            <a href={env.sources.earthquakes} target="_blank" rel="noopener noreferrer" className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-[#2563EB]">
              Recent earthquakes <span aria-hidden>↗</span>
            </a>
          ) : (
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent earthquakes</div>
          )}
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

// Shared render for both the owner's /local and public /local/share/[token].
export function LocalDigestView({
  digest, heading, subheading, note,
}: { digest: MyLocalDigest; heading: string; subheading?: string; note?: ReactNode }) {
  const comingSoon = (key: string) => digest.comingSoonSections.includes(key)
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 text-foreground">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">{heading}</h1>
        {digest.coverageAreas.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Covering <span className="font-semibold text-foreground">{digest.coverageAreas.join(' + ')}</span>
          </p>
        )}
        {subheading && <p className="mt-1 text-xs text-muted-foreground">{subheading}</p>}
        {note}
      </header>

      <NeedToKnowSection events={digest.needToKnow} />
      <EventSection title="Changing Around You" events={digest.changingAroundYou} />
      <EventSection title="Your Government" events={digest.yourGovernment} />
      {digest.environment && <EnvironmentModule env={digest.environment} />}
      <EventSection title="Roads & Incidents" events={digest.roadsAndIncidents} comingSoon={comingSoon('roadsAndIncidents')} />
      <CameraSection cameras={digest.trafficCameras} />
      <EventSection title="Local Reporting" events={digest.localReporting} />
      <EventSection title="Local Blindspot" events={digest.localBlindspot} />
    </main>
  )
}
