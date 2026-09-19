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
import { fetchPurpleAir } from './adapters/purpleair'
import { fetchFirms } from './adapters/firms'
import { fetch511Events } from './adapters/bay511'
import { fetchMarinPermits } from './adapters/marin-permits'
import { fetchMarinAgendas } from './adapters/marin-granicus'
import { selectLocalBlindspots } from './blindspot'
import { fetchLocalNews, fetchCoverageArticles, articleToLocalEvent, COVERAGE_OUTLET_NAMES } from './adapters/local-news'
import { detectLocalCoverage } from './coverage'
import { buildAgendaItemEvents } from './agenda-extract'

export const NEED_TO_KNOW_MAX = 4
export const GOVERNMENT_MAX = 6

// Your Government section: when the agenda's consequential items were extracted,
// show the top `limit` by consequence and drop the bare "agenda published" meeting
// entry (redundant — every item links to the agenda). `excludeIds` drops items
// already surfaced elsewhere (the Blindspot lifts major uncovered items out, so
// they aren't shown twice). Only fall back to the bare meetings when nothing could
// be extracted (no API key / fetch failed).
export function selectGovernmentEvents(
  agendaItems: LocalEvent[],
  meetings: LocalEvent[],
  limit: number,
  excludeIds: Set<string> = new Set(),
): LocalEvent[] {
  const items = agendaItems.filter(e => !excludeIds.has(e.id))
  if (items.length === 0) return meetings
  return [...items].sort((a, b) => b.consequenceScore - a.consequenceScore).slice(0, limit)
}

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
  comingSoonSections: string[]
}

export interface SnapshotParts {
  forecast?: { wind: WindReading; temperatureF?: number; shortForecast?: string }
  alerts?: { alerts: NwsAlertSummary[]; fireRisk: FireRisk }
  quakes?: QuakeSummary[]
  tide?: TideReading
  airQuality?: AirQualityReading
  thermalAnomalies?: { count: number; nearestMiles?: number }
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
  comingSoonSections: string[]
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
    comingSoonSections: input.comingSoonSections,
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
  const airQuality = await resolveAirQuality(point)
  // Active-fire / thermal anomalies near the point (NASA FIRMS). Key-gated.
  const thermalAnomalies = process.env.NASA_FIRMS_MAP_KEY
    ? await safe(() => fetchFirms(point, process.env.NASA_FIRMS_MAP_KEY!))
    : undefined
  return buildEnvironmentSnapshot({ forecast, alerts, quakes, tide, airQuality, thermalAnomalies })
}

// Air quality: prefer AirNow (official EPA monitors); fall back to PurpleAir
// (crowd sensors) when AirNow is unavailable or returns no usable observation
// near the point. Each source is only tried if its key is configured.
async function resolveAirQuality(point: { lat: number; lng: number }): Promise<AirQualityReading | undefined> {
  const airnow = process.env.AIRNOW_API_KEY
    ? await safe(async () => {
        const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${point.lat}&longitude=${point.lng}&distance=25&API_KEY=${process.env.AIRNOW_API_KEY}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`airnow ${res.status}`)
        return normalizeAirNow(await res.json())
      })
    : undefined
  if (airnow && airnow.aqi > 0) return airnow // AirNow had a real reading

  const purpleair = process.env.PURPLEAIR_API_KEY
    ? await safe(() => fetchPurpleAir(point, process.env.PURPLEAIR_API_KEY!))
    : undefined
  return purpleair ?? airnow // PurpleAir if we got one, else whatever AirNow returned
}

export async function buildMyLocalDigest(): Promise<MyLocalDigest> {
  const places = await getSavedPlaces()
  const environment = await buildLiveEnvironment(representativePoint())

  // Build B/C live sections. A failed fetch yields an empty section (omitted) —
  // never fabricated fixture data.
  const changing = (await safe(() => fetchMarinPermits(6, 'consequence'))) ?? [] // most consequential recent permits (expired dropped, titles cleaned in the adapter)
  const agendas = await safe(() => fetchMarinAgendas(5))

  // Agenda-item LLM extraction (Build B/C): pull the consequential items
  // (contracts, grants, dollar figures) out of the soonest meeting's agenda so a
  // meeting becomes specific decisions. Needs an API key; degrades to meetings-only.
  const apiKey = process.env.ANTHROPIC_API_KEY
  const agendaItems = agendas && apiKey
    ? (await safe(() => buildAgendaItemEvents(agendas, apiKey))) ?? []
    : []

  // Local journalism (Build C). Local Reporting shows directly-fetchable outlets
  // (real links); the Blindspot's coverage check also queries the Marin IJ via
  // Google News, so "no coverage" reflects the county daily, not just the weeklies.
  const articles = (await safe(() => fetchLocalNews())) ?? []
  const reporting = articles.slice(0, 6).map(articleToLocalEvent)
  const coverageArticles = (await safe(() => fetchCoverageArticles())) ?? articles

  // Local Blindspot: MAJOR public records (>= ~$250k) checked for coverage against
  // the local outlets (incl. Marin IJ). An uncovered major record is a blindspot;
  // one covered by 2+ outlets is not. Agenda-item contracts join the permit pool,
  // so a big uncovered county contract can surface. Empty -> section omitted.
  const permitPool = (await safe(() => fetchMarinPermits(50, 'consequence'))) ?? []
  const blindspotPool = [...permitPool, ...agendaItems]
  const outletsChecked = COVERAGE_OUTLET_NAMES.join(', ')
  const blindspots = selectLocalBlindspots(
    blindspotPool.map(e => ({ event: e, localMediaOutlets: detectLocalCoverage(e, coverageArticles) })),
    { minConsequence: 0.9, limit: 3 },
  ).map(b => ({
    ...b.event,
    whyItMatters: `${b.event.whatChanged ? b.event.whatChanged + ' · ' : ''}${b.localMediaOutlets === 0 ? `Not found in the local outlets we track (${outletsChecked}).` : `Covered by only ${b.localMediaOutlets} of the local outlets we track (${outletsChecked}).`}`,
  }))

  // Your Government: the consequential extracted decisions, ranked and capped —
  // EXCLUDING anything the Blindspot already surfaced, so the two sections never
  // repeat the same item. Falls back to the bare meeting only when nothing was
  // extracted (no API key / fetch failed).
  const government = selectGovernmentEvents(
    agendaItems, agendas ?? [], GOVERNMENT_MAX, new Set(blindspots.map(b => b.id)),
  )

  // Roads & Incidents (Build C) — 511 SF Bay traffic events near the point. Key-gated;
  // if no key it stays a "coming soon" placeholder, matching the honest-sections rule.
  const roads = process.env.BAY511_API_KEY
    ? (await safe(() => fetch511Events(process.env.BAY511_API_KEY!, representativePoint()))) ?? []
    : []

  // Honest sections only — never fabricated data. A section with no live source
  // yet (Need To Know alerts) is marked "coming soon" and shown as a placeholder;
  // a live section that fetched nothing is simply empty (omitted).
  const comingSoonSections = ['needToKnow']
  if (!process.env.BAY511_API_KEY) comingSoonSections.push('roadsAndIncidents')

  return assembleMyLocalDigest({
    places,
    environment,
    sections: {
      needToKnow: [], // no live alert source wired yet (Build C)
      changingAroundYou: changing,
      yourGovernment: government,
      roadsAndIncidents: roads,
      localReporting: reporting,
      localBlindspot: blindspots, // engine output; empty -> section omitted
    },
    comingSoonSections,
  })
}
