import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'

// AirNow current air quality as a §7 ingestion source. Records every reading as a
// source_item, but emits an air_quality EVENT only when AQI is elevated (≥101,
// "Unhealthy for Sensitive Groups" or worse) — the point at which it belongs in
// Need To Know (wildfire smoke, etc.). Good/Moderate air produces no event (the
// live Environment snapshot still shows the AQI stat). resolvesByAbsence clears the
// event when air improves. Needs AIRNOW_API_KEY (no key → no ingest, stays healthy).
//
// (A full §7.1 observation time-series in local_observation is a later increment —
// deferred until a trend/sparkline consumer exists; this threshold-event path
// delivers the user-facing air-quality alerts now.)
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_CENTER = { lat: 37.9735, lng: -122.5311 }
export const AQI_ALERT_THRESHOLD = 101 // Unhealthy for Sensitive Groups (orange)

interface AirNowObs {
  ParameterName?: string
  AQI?: number
  Category?: { Name?: string }
  ReportingArea?: string
  Latitude?: number
  Longitude?: number
  DateObserved?: string
  HourObserved?: number
}

export function parseAirNowItems(body: unknown, opts: { center?: { lat: number; lng: number } } = {}): NormalizedItem[] {
  const center = opts.center ?? MARIN_CENTER
  const obs = (Array.isArray(body) ? body : []) as AirNowObs[]
  const withAqi = obs.filter(o => typeof o.AQI === 'number')
  if (withAqi.length === 0) return []

  const worst = withAqi.reduce((a, b) => ((b.AQI ?? 0) > (a.AQI ?? 0) ? b : a))
  const aqi = worst.AQI ?? 0
  const category = worst.Category?.Name ?? 'Unknown'
  const area = worst.ReportingArea || 'Marin'
  const lat = typeof worst.Latitude === 'number' ? worst.Latitude : center.lat
  const lng = typeof worst.Longitude === 'number' ? worst.Longitude : center.lng
  const observedKey = `${worst.DateObserved ?? ''}:${worst.HourObserved ?? ''}`

  return [{
    externalId: area,
    contentHash: hashContent([area, String(aqi), category, observedKey]),
    title: `Air quality: ${category} (AQI ${aqi})`,
    url: 'https://www.airnow.gov/',
    publishedAt: new Date().toISOString(),
    placeText: area,
    geo: { lat, lng, precision: 'county' }, // AirNow reporting area is county-level
    extracted: { aqi, category, parameter: worst.ParameterName ?? '', area },
  }]
}

export function airnowItemToCandidates(item: NormalizedItem): EventCandidate[] {
  const ex = item.extracted ?? {}
  const aqi = Number(ex.aqi) || 0
  if (aqi < AQI_ALERT_THRESHOLD) return [] // Good/Moderate → no event
  return [{
    eventType: 'air_quality',
    dedupeKey: `airnow-marin:${ex.area ?? item.externalId ?? 'marin'}`,
    headline: item.title,
    summary: `${ex.parameter || 'Air quality'} — ${ex.category}. Sensitive groups should limit prolonged outdoor exertion.`,
    startedAt: item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { aqi },
  }]
}

export const airnowAdapter: SourceAdapter = {
  slug: 'airnow-marin',
  resolvesByAbsence: true, // AQI drops below the threshold → no candidate → resolved
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const key = process.env.AIRNOW_API_KEY
    if (!key) return [] // no key → nothing to ingest (source stays healthy)
    const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${MARIN_CENTER.lat}&longitude=${MARIN_CENTER.lng}&distance=25&API_KEY=${key}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`AirNow HTTP ${res.status}`)
    return [{ body: await res.json(), contentType: 'application/json', url: 'https://www.airnowapi.org/aq/observation/latLong/current/', fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseAirNowItems(raw.body)
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return airnowItemToCandidates(item)
  },
}
