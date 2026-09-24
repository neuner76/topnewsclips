import type { ReactNode } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SectionCard from '@/components/SectionCard'
import { formatFreshness } from '@/lib/local/format'
import type { MyLocalDigest } from '@/lib/local/digest'
import type { LocalEvent } from '@/lib/local/types'
import type { EnvironmentSnapshot } from '@/lib/local/adapters/types'

// Section identity — matches the national digest's card treatment (accent bar +
// tracked-uppercase eyebrow), one accent per local section.
const SECTION = {
  needToKnow: { icon: '📌', title: 'Need To Know Near You', accent: '#DC2626' },
  changing: { icon: '🏗️', title: 'Changing Around You', accent: '#16A34A' },
  government: { icon: '🏛️', title: 'Your Government', accent: '#2563EB' },
  environment: { icon: '🌤️', title: 'Your Environment', accent: '#0F766E' },
  roads: { icon: '🚧', title: 'Roads & Incidents', accent: '#EA580C' },
  cameras: { icon: '📹', title: 'Traffic Cameras', accent: '#0F766E' },
  reporting: { icon: '📰', title: 'Local Reporting', accent: '#7E22CE' },
  blindspot: { icon: '🔦', title: 'Local Blindspot', accent: '#C2410C' },
} as const

function Eyebrow({ icon, title, accent, aside }: { icon: string; title: string; accent: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none">{icon}</span>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{title}</h2>
      {aside && <span className="ml-auto text-[10px] font-medium text-muted-foreground">{aside}</span>}
    </div>
  )
}

// A borderless story row (no card-in-card inside the SectionCard).
function EventRow({ e }: { e: LocalEvent }) {
  const url = e.sources.find(s => s.url)?.url
  const ts = e.latestUpdateAt || e.firstSeenAt
  const freshness = formatFreshness(ts)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[15px] font-semibold leading-snug text-foreground group-hover:text-[#2563EB] transition-colors">
          {e.title}{url && <span aria-hidden className="text-muted-foreground"> →</span>}
        </div>
        {e.amountUsd != null && (
          <span className="shrink-0 rounded-md bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#0F172A]">
            ${e.amountUsd.toLocaleString()}
          </span>
        )}
      </div>
      {(e.whyItMatters || e.summary || e.whatChanged) && (
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.whyItMatters ?? e.summary ?? e.whatChanged}</p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{e.confidence} confidence</span>
        {e.sources[0] && <span>· {e.sources[0].label}</span>}
        {freshness && <span title={new Date(ts).toISOString()}>· {freshness}</span>}
      </div>
    </>
  )
  const cls = 'group block border-t border-[#EFF2F6] py-3.5 first:border-t-0 first:pt-0 last:pb-0'
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
    : <div className={cls}>{body}</div>
}

function EventListSection({ meta, events }: { meta: { icon: string; title: string; accent: string }; events: LocalEvent[] }) {
  if (events.length === 0) return null // omit empty sections — never show stale/fake data
  return (
    <SectionCard accent={meta.accent}>
      <Eyebrow icon={meta.icon} title={meta.title} accent={meta.accent} />
      <div>{events.map(e => <EventRow key={e.id} e={e} />)}</div>
    </SectionCard>
  )
}

function NeedToKnowSection({ events }: { events: LocalEvent[] }) {
  const meta = SECTION.needToKnow
  return (
    <SectionCard accent={meta.accent}>
      <Eyebrow icon={meta.icon} title={meta.title} accent={meta.accent} />
      {events.length === 0 ? (
        <div className="rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-3 text-[13px] text-[#166534]">
          ✓ Nothing urgent near you right now — no active weather alerts, wildfires, nearby earthquakes, fire detections, or full road closures.
        </div>
      ) : (
        <div>{events.map(e => <EventRow key={e.id} e={e} />)}</div>
      )}
    </SectionCard>
  )
}

function CameraSection({ cameras }: { cameras: MyLocalDigest['trafficCameras'] }) {
  if (!cameras || cameras.length === 0) return null
  const meta = SECTION.cameras
  return (
    <SectionCard accent={meta.accent}>
      <Eyebrow icon={meta.icon} title={meta.title} accent={meta.accent} />
      <div className="grid grid-cols-2 gap-2.5">
        {cameras.map(cam => (
          <a
            key={cam.id}
            href={cam.streamUrl || cam.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-colors hover:border-[#2563EB]"
          >
            {/* Live Caltrans snapshot (~5-min refresh); plain img so next/image can't cache a stale frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cam.imageUrl} alt={cam.label} loading="lazy" className="aspect-video w-full bg-muted object-cover" />
            <div className="truncate px-2.5 py-2 text-[11px] text-muted-foreground">
              {cam.route && <span className="font-semibold text-foreground">{cam.route}</span>}
              {cam.route && cam.label ? ' · ' : ''}{cam.label}
            </div>
          </a>
        ))}
      </div>
    </SectionCard>
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
  const cls = 'rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5'
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} block transition-colors hover:border-[#2563EB]`}>{inner}</a>
    : <div className={cls}>{inner}</div>
}

function EnvironmentModule({ env }: { env: EnvironmentSnapshot }) {
  const meta = SECTION.environment
  return (
    <SectionCard accent={meta.accent}>
      <Eyebrow icon={meta.icon} title={meta.title} accent={meta.accent} aside={`updated ${formatFreshness(env.dataAsOf)}`} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
            const bodyEl = (
              <>
                <div className="text-sm font-semibold text-foreground">{a.event}{env.sources?.alerts && <span aria-hidden className="text-muted-foreground"> ↗</span>}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.area}</p>
              </>
            )
            const cls = 'block rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3'
            return env.sources?.alerts
              ? <a key={i} href={env.sources.alerts} target="_blank" rel="noopener noreferrer" className={`${cls} transition-colors hover:border-red-500/40`}>{bodyEl}</a>
              : <div key={i} className={cls}>{bodyEl}</div>
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
    </SectionCard>
  )
}

// Shared render for both the owner's /local and public /local/share/[token].
export function LocalDigestView({
  digest, heading, subheading, note,
}: { digest: MyLocalDigest; heading: string; subheading?: string; note?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[780px] px-4 py-8 sm:px-6 text-foreground">
        <header className="mb-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">📍 Local Briefing</p>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">{heading}</h1>
          {digest.coverageAreas.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Covering <span className="font-semibold text-foreground">{digest.coverageAreas.join(' + ')}</span>
            </p>
          )}
          {subheading && <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>}
          {note}
        </header>

        <NeedToKnowSection events={digest.needToKnow} />
        <EventListSection meta={SECTION.changing} events={digest.changingAroundYou} />
        <EventListSection meta={SECTION.government} events={digest.yourGovernment} />
        {digest.environment && <EnvironmentModule env={digest.environment} />}
        <EventListSection meta={SECTION.roads} events={digest.roadsAndIncidents} />
        <CameraSection cameras={digest.trafficCameras} />
        <EventListSection meta={SECTION.reporting} events={digest.localReporting} />
        <EventListSection meta={SECTION.blindspot} events={digest.localBlindspot} />
      </main>
      <Footer />
    </div>
  )
}
