// Need To Know Near You — the urgent, act-now subset. This is a *synthesis*, not
// a new source: it promotes the genuinely urgent signals we already fetch live
// (NWS active alerts, nearby significant earthquakes, nearby active-fire
// detections, full road closures happening now) into one prioritized section.
// Empty is a valid, honest state ("nothing urgent near you right now").
import type { EnvironmentSnapshot, NwsAlertSummary } from './adapters/types'
import type { LocalEvent, LocalEventType } from './types'

interface Opts {
  near: { lat: number; lng: number }
  now?: number // epoch seconds
  limit?: number
  quakeMinMagnitude?: number
  quakeMaxMiles?: number
  fireMaxMiles?: number
}

// Severity → base urgency score. Only Extreme/Severe (or a Moderate *Warning*,
// or an evacuation/tsunami/red-flag event) clears the bar for Need To Know.
const SEVERITY_SCORE: Record<string, number> = { extreme: 0.98, severe: 0.9, moderate: 0.75 }
const ALWAYS_INCLUDE = /(evacuation|tsunami|red flag)/i

function alertEventType(event: string): LocalEventType {
  const e = event.toLowerCase()
  if (e.includes('flood')) return 'flood'
  if (e.includes('fire') || e.includes('red flag')) return 'fire'
  if (e.includes('evacuation') || e.includes('tsunami') || e.includes('shelter')) return 'emergency'
  return 'weather'
}

function includeAlert(a: NwsAlertSummary): boolean {
  const sev = (a.severity ?? '').toLowerCase()
  if (ALWAYS_INCLUDE.test(a.event)) return true
  if (sev === 'extreme' || sev === 'severe') return true
  if (sev === 'moderate' && /warning/i.test(a.event)) return true
  return false
}

export function buildNeedToKnow(env: EnvironmentSnapshot, roads: LocalEvent[], opts: Opts): LocalEvent[] {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const nowIso = new Date(now * 1000).toISOString()
  const near = opts.near
  const out: Array<LocalEvent & { _score: number }> = []

  // 1) NWS active alerts (the canonical "need to know").
  for (const a of env.activeAlerts ?? []) {
    if (!includeAlert(a)) continue
    const sev = (a.severity ?? '').toLowerCase()
    const score = Math.max(SEVERITY_SCORE[sev] ?? 0.85, ALWAYS_INCLUDE.test(a.event) ? 0.92 : 0)
    const observedAt = a.onset || nowIso
    out.push({
      _score: score,
      id: `ntk-alert-${a.event.toLowerCase().replace(/\s+/g, '-')}-${(a.expires ?? observedAt).slice(0, 16)}`,
      title: a.event,
      eventType: alertEventType(a.event),
      status: 'new',
      firstSeenAt: observedAt,
      latestUpdateAt: observedAt,
      geo: { latitude: near.lat, longitude: near.lng, counties: ['Marin County'] },
      consequenceScore: score,
      confidence: 'high',
      sources: [{ type: 'official_alert', label: 'National Weather Service', url: 'https://alerts.weather.gov/', observedAt, status: 'confirmed' }],
      whatChanged: [a.headline || a.area, a.expires ? `until ${new Date(a.expires).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : null].filter(Boolean).join(' · ') || undefined,
    })
  }

  // 2) Nearby significant earthquakes.
  const minMag = opts.quakeMinMagnitude ?? 3.5
  const maxMi = opts.quakeMaxMiles ?? 50
  for (const q of env.recentEarthquakes ?? []) {
    if (q.magnitude < minMag) continue
    if (q.distanceMiles != null && q.distanceMiles > maxMi) continue
    const dist = q.distanceMiles != null ? ` — ~${Math.round(q.distanceMiles)} mi away` : ''
    out.push({
      _score: Math.min(0.95, 0.6 + (q.magnitude - minMag) * 0.1),
      id: `ntk-quake-${q.time}`,
      title: `M${q.magnitude.toFixed(1)} earthquake${dist}`,
      eventType: 'earthquake',
      status: 'new',
      firstSeenAt: q.time,
      latestUpdateAt: q.time,
      geo: { latitude: q.latitude, longitude: q.longitude, counties: ['Marin County'] },
      consequenceScore: Math.min(0.95, 0.6 + (q.magnitude - minMag) * 0.1),
      confidence: 'high',
      sources: [{ type: 'official_alert', label: 'USGS', url: 'https://earthquake.usgs.gov/', observedAt: q.time, status: 'confirmed' }],
      whatChanged: q.place || undefined,
    })
  }

  // 3) Nearby active-fire / thermal-anomaly detections.
  const ta = env.thermalAnomalies
  const fireMax = opts.fireMaxMiles ?? 15
  if (ta && ta.count > 0 && (ta.nearestMiles == null || ta.nearestMiles <= fireMax)) {
    const dist = ta.nearestMiles != null ? ` ~${ta.nearestMiles} mi away` : ' nearby'
    out.push({
      _score: 0.8,
      id: 'ntk-fire-detections',
      title: `Active fire detection${ta.count > 1 ? 's' : ''}${dist}`,
      eventType: 'fire',
      status: 'new',
      firstSeenAt: nowIso,
      latestUpdateAt: nowIso,
      geo: { latitude: near.lat, longitude: near.lng, counties: ['Marin County'] },
      consequenceScore: 0.8,
      confidence: 'medium', // satellite heat signature, not a confirmed structure fire
      sources: [{ type: 'official_alert', label: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', observedAt: nowIso, status: 'observed' }],
      whatChanged: `${ta.count} satellite heat detection${ta.count > 1 ? 's' : ''} in the last 24h`,
    })
  }

  // 4) Full road closures happening now (promoted from Roads & Incidents).
  for (const r of roads) {
    if (r.status !== 'new') continue // active now, not a future closure
    if (!/full closure/i.test(r.title)) continue
    out.push({ _score: Math.max(0.72, r.consequenceScore ?? 0.7), ...r })
  }

  out.sort((a, b) => b._score - a._score)
  const limited = out.slice(0, opts.limit ?? 5)
  return limited.map(({ _score, ...e }) => { void _score; return e })
}
