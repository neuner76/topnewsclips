// TopNewsClips Local — My Local digest assembly (Task 13).
//
// Pure assembly (assembleMyLocalDigest, buildEnvironmentSnapshot) is unit-tested;
// buildMyLocalDigest is the live wrapper that reads seeded places, runs the
// environmental adapters, and assembles the page's data. Build A: Your Environment
// is live; every other section is fixture-backed (marked so the UI badges it).

import { createClient } from '@supabase/supabase-js'
import { toPublicPlace, type PublicSavedPlace } from './privacy'
import type { SavedPlace, LocalEvent } from './types'
import type {
  EnvironmentSnapshot, WindReading, FireRisk, NwsAlertSummary, QuakeSummary,
  TideReading, AirQualityReading,
} from './adapters/types'
import { normalizeNwsForecast, normalizeNwsAlerts } from './adapters/nws'
import { normalizeUsgsEarthquakes } from './adapters/usgs'
import { normalizeNoaaTides } from './adapters/noaa-tides'
import { normalizeAirNow } from './adapters/airnow'
import { fetchMarinPermits } from './adapters/marin-permits'
import { fetchMarinAgendas } from './adapters/marin-granicus'
import { selectLocalBlindspots } from './blindspot'
import { fetchLocalNews, articleToLocalEvent } from './adapters/local-news'
import { detectLocalCoverage } from './coverage'
import {
  FIXTURE_NEED_TO_KNOW, FIXTURE_CHANGING_AROUND_YOU, FIXTURE_YOUR_GOVERNMENT,
  FIXTURE_ROADS_AND_INCIDENTS, FIXTURE_LOCAL_REPORTING,
} from './fixtures'

export const NEED_TO_KNOW_MAX = 4
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_POINT = { lat: 37.9735, lng: -122.5311 } // San Rafael — representative
const TIDE_STATION = '9415020' // Point Reyes

export interface MyLocalDigest {
  generatedAt: string
  places: PublicSavedPlace[]
  needToKnow: LocalEvent[]
  changingAroundYou: LocalEvent[]
  yourGovernment: LocalEvent[]
  environment: EnvironmentSnapshot | null
  roadsAndIncidents: LocalEvent[]
  localReporting: LocalEvent[]
  localBlindspot: LocalEvent[]
  fixtureSections: string[]
}

export interface SnapshotParts {
  forecast?: { wind: WindReading; temperatureF?: number; shortForecast?: string }
  alerts?: { alerts: NwsAlertSummary[]; fireRisk: FireRisk }
  quakes?: QuakeSummary[]
  tide?: TideReading
  airQuality?: AirQualityReading
  thermalAnomalies?: { count: number }
}

export function buildEnvironmentSnapshot(parts: SnapshotParts): EnvironmentSnapshot {
  return {
    wind: parts.forecast?.wind,
    fireRisk: parts.alerts?.fireRisk,
    airQuality: parts.airQuality,
    tide: parts.tide,
    activeAlerts: parts.alerts?.alerts ?? [],
    recentEarthquakes: parts.quakes ?? [],
    thermalAnomalies: parts.thermalAnomalies,
    dataAsOf: new Date().toISOString(),
  }
}

export interface AssembleInput {
  places: SavedPlace[]
  environment: EnvironmentSnapshot | null
  sections: {
    needToKnow: LocalEvent[]
    changingAroundYou: LocalEvent[]
    yourGovernment: LocalEvent[]
    roadsAndIncidents: LocalEvent[]
    localReporting: LocalEvent[]
    localBlindspot: LocalEvent[]
  }
  fixtureSections: string[]
  generatedAt?: string
}

export function assembleMyLocalDigest(input: AssembleInput): MyLocalDigest {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    places: input.places.map(toPublicPlace),
    needToKnow: input.sections.needToKnow.slice(0, NEED_TO_KNOW_MAX),
    changingAroundYou: input.sections.changingAroundYou,
    yourGovernment: input.sections.yourGovernment,
    environment: input.environment,
    roadsAndIncidents: input.sections.roadsAndIncidents,
    localReporting: input.sections.localReporting,
    localBlindspot: input.sections.localBlindspot,
    fixtureSections: input.fixtureSections,
  }
}

// --- live wiring (not unit-tested; I/O) ---

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Read seeded places (non-geometry columns only — geometry is read via PostGIS in
// later relevance queries, not needed for rendering). Service role bypasses RLS.
async function getSavedPlaces(): Promise<SavedPlace[]> {
  const sb = getServiceClient()
  const { data } = await sb.from('local_saved_places')
    .select('id,label,type,radius_miles,city,county,state,is_private').order('label')
  return (data ?? []).map(r => ({
    id: r.id, label: r.label, type: r.type,
    latitude: 0, longitude: 0, // not exposed; representative point comes from env/seed
    radiusMiles: r.radius_miles ?? undefined,
    city: r.city ?? undefined, county: r.county ?? undefined, state: r.state ?? undefined,
    isPrivate: r.is_private,
  }))
}

function representativePoint(): { lat: number; lng: number } {
  const lat = Number(process.env.LOCAL_HOME_LAT)
  const lng = Number(process.env.LOCAL_HOME_LNG)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return { lat: MARIN_POINT.lat, lng: MARIN_POINT.lng }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try { return await fn() } catch { return undefined }
}

async function buildLiveEnvironment(point: { lat: number; lng: number }): Promise<EnvironmentSnapshot> {
  const forecast = await safe(async () => {
    const res = await fetch('https://api.weather.gov/gridpoints/MTR/83,121/forecast', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`forecast ${res.status}`)
    return normalizeNwsForecast(await res.json())
  })
  const alerts = await safe(async () => {
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${point.lat},${point.lng}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`alerts ${res.status}`)
    return normalizeNwsAlerts(await res.json())
  })
  const quakes = await safe(async () => {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`usgs ${res.status}`)
    return normalizeUsgsEarthquakes(await res.json(), { near: { latitude: point.lat, longitude: point.lng }, radiusMiles: 100 })
  })
  const tide = await safe(async () => {
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${TIDE_STATION}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`tides ${res.status}`)
    return normalizeNoaaTides(await res.json(), { station: TIDE_STATION, now: new Date() })
  })
  const airQuality = process.env.AIRNOW_API_KEY
    ? await safe(async () => {
        const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${point.lat}&longitude=${point.lng}&distance=25&API_KEY=${process.env.AIRNOW_API_KEY}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`airnow ${res.status}`)
        return normalizeAirNow(await res.json())
      })
    : undefined
  return buildEnvironmentSnapshot({ forecast, alerts, quakes, tide, airQuality })
}

export async function buildMyLocalDigest(): Promise<MyLocalDigest> {
  const places = await getSavedPlaces()
  const environment = await buildLiveEnvironment(representativePoint())

  // Build B/C live sections; each falls back to its fixture if the fetch fails.
  const changing = (await safe(() => fetchMarinPermits(6, 'recency'))) ?? [] // recent permit activity
  const changingLive = changing.length > 0
  const agendas = await safe(() => fetchMarinAgendas(5))
  const govLive = !!agendas && agendas.length > 0

  // Local journalism (Build C) — feeds Local Reporting AND the coverage detector.
  const articles = (await safe(() => fetchLocalNews())) ?? []
  const reporting = articles.slice(0, 6).map(articleToLocalEvent)
  const reportingLive = reporting.length > 0

  // Local Blindspot: MAJOR public records (>= ~$250k) with real coverage detection
  // against the local outlets above. An uncovered major record is a blindspot; one
  // covered by 2+ outlets is not. Empty -> section omitted (never faked).
  const blindspotPool = (await safe(() => fetchMarinPermits(50, 'consequence'))) ?? []
  const blindspots = selectLocalBlindspots(
    blindspotPool.map(e => ({ event: e, localMediaOutlets: detectLocalCoverage(e, articles) })),
    { minConsequence: 0.9, limit: 3 },
  ).map(b => ({
    ...b.event,
    whyItMatters: `${b.event.whatChanged ? b.event.whatChanged + ' · ' : ''}${b.localMediaOutlets === 0 ? 'No tracked local outlets detected covering it.' : `Only ${b.localMediaOutlets} tracked local outlet(s) covering it.`}`,
  }))

  const fixtureSections = ['needToKnow', 'roadsAndIncidents']
  if (!changingLive) fixtureSections.push('changingAroundYou')
  if (!govLive) fixtureSections.push('yourGovernment')
  if (!reportingLive) fixtureSections.push('localReporting')

  return assembleMyLocalDigest({
    places,
    environment,
    sections: {
      needToKnow: FIXTURE_NEED_TO_KNOW,
      changingAroundYou: changingLive ? changing : FIXTURE_CHANGING_AROUND_YOU,
      yourGovernment: govLive ? agendas : FIXTURE_YOUR_GOVERNMENT,
      roadsAndIncidents: FIXTURE_ROADS_AND_INCIDENTS,
      localReporting: reportingLive ? reporting : FIXTURE_LOCAL_REPORTING,
      localBlindspot: blindspots, // engine output; empty -> section omitted
    },
    fixtureSections,
  })
}
