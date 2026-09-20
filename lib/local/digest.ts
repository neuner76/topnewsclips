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
import { buildNeedToKnow } from './need-to-know'
import { type Anchor } from './anchors'
import { PUBLIC_SEED_PLACES } from './seed-places'
import { fetch511Events } from './adapters/bay511'
import { fetchCaltransCameras, type LocalCamera } from './adapters/caltrans-cameras'
import { fetchCaltransClosures } from './adapters/caltrans-lcs'
import { fetchMarinPermits } from './adapters/marin-permits'
import { fetchMarinAgendas } from './adapters/marin-granicus'
import { selectLocalBlindspots } from './blindspot'
import { fetchLocalNews, fetchCoverageArticles, articleToLocalEvent, isLocalToMarin, COVERAGE_OUTLET_NAMES } from './adapters/local-news'
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
  trafficCameras: LocalCamera[]
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
  trafficCameras?: LocalCamera[]
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
    trafficCameras: input.trafficCameras ?? [],
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

// PostGIS geometry columns come back from PostgREST as GeoJSON ({type,coordinates})
// — sometimes as an object, sometimes a JSON string. Pull [lng,lat] out of either.
function coordsFromCenter(center: unknown): { lat: number; lng: number } | null {
  let obj: unknown = center
  if (typeof center === 'string') { try { obj = JSON.parse(center) } catch { return null } }
  const c = (obj as { coordinates?: unknown } | null)?.coordinates
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') return { lat: c[1], lng: c[0] }
  return null
}

// A place broader than this is treated as context, not a proximity anchor — an
// 18 mi "county" circle centered mid-county is basically county-wide and would
// re-admit far towns (Mill Valley, Tiburon). Only tight, point-scale places
// (a town, a neighborhood) drive the "near you" filtering.
const MAX_ANCHOR_RADIUS_MILES = 14

// Multi-place anchors: one point+radius per saved place. Coordinates come from the
// DB `center` geometry; if PostgREST doesn't hand back parseable GeoJSON we fall
// back to the committed seed coordinates by label, and finally to the env home
// point — so relevance never regresses, it only sharpens once geometry is read.
async function getPlaceAnchors(): Promise<Anchor[]> {
  const seedByLabel = new Map(PUBLIC_SEED_PLACES.map(p => [p.label.toLowerCase(), p]))
  const anchors: Anchor[] = []
  try {
    const sb = getServiceClient()
    const { data } = await sb.from('local_saved_places').select('label, radius_miles, center')
    for (const r of (data ?? []) as Array<{ label: string; radius_miles: number | null; center: unknown }>) {
      let pt = coordsFromCenter(r.center)
      let radius = r.radius_miles ?? undefined
      if (!pt) {
        const seed = seedByLabel.get((r.label ?? '').toLowerCase())
        if (seed) { pt = { lat: seed.latitude, lng: seed.longitude }; radius = radius ?? seed.radiusMiles }
      }
      const r2 = radius ?? 10
      if (pt && r2 <= MAX_ANCHOR_RADIUS_MILES) anchors.push({ lat: pt.lat, lng: pt.lng, radiusMiles: r2, label: r.label })
    }
  } catch { /* fall through to the env home point */ }
  if (anchors.length === 0) {
    const home = representativePoint()
    return [{ lat: home.lat, lng: home.lng, radiusMiles: 10, label: 'Home' }]
  }
  return anchors
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
  // Multi-place anchors: proximity now honors EVERY saved place (Novato, West
  // Marin, …), not just one home point — each with its own radius.
  const anchors = await getPlaceAnchors()

  // Build B/C live sections. A failed fetch yields an empty section (omitted) —
  // never fabricated fixture data.
  // Changing Around You: most consequential recent permits near ANY saved place.
  const changing = (await safe(() => fetchMarinPermits(6, 'consequence', { anchors }))) ?? []
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
  // Hard-filter to Marin: local weeklies pass; regional outlets (KQED) only when
  // the story names a Marin/Novato place. Keeps the section genuinely local.
  const reporting = articles.filter(isLocalToMarin).slice(0, 6).map(articleToLocalEvent)
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

  // Roads & Incidents (Build C) — live 511 SF Bay incidents (key-gated) merged
  // with Caltrans D4 lane closures (public, no key). 511 gives live collisions;
  // Caltrans LCS adds scheduled construction/maintenance closures.
  const roads511 = process.env.BAY511_API_KEY
    ? (await safe(() => fetch511Events(process.env.BAY511_API_KEY!, representativePoint(), { anchors }))) ?? []
    : []
  // Near any saved place; still Marin/Sonoma only (drops SR-29 Napa/Solano across the bay).
  const closures = (await safe(() => fetchCaltransClosures(representativePoint(), { anchors, counties: ['Marin', 'Sonoma'] }))) ?? []
  const roads = [...roads511, ...closures].sort((a, b) => (b.consequenceScore ?? 0) - (a.consequenceScore ?? 0)).slice(0, 8)
  // Nearby live traffic cameras (Caltrans D4 CCTV — public, no key), near any place.
  const trafficCameras = (await safe(() => fetchCaltransCameras(representativePoint(), { anchors }))) ?? []

  // Need To Know Near You — the urgent, act-now subset synthesized from the live
  // signals above (NWS alerts, nearby significant quakes, active-fire detections,
  // full closures happening now). Empty is honest ("nothing urgent right now").
  const needToKnow = buildNeedToKnow(environment, roads, { near: representativePoint() })

  // Honest sections only — never fabricated data. A live section that fetched
  // nothing is simply empty; Need To Know now renders an "all clear" state
  // instead, so no section needs a "coming soon" placeholder anymore.
  const comingSoonSections: string[] = []

  return assembleMyLocalDigest({
    places,
    environment,
    sections: {
      needToKnow,
      changingAroundYou: changing,
      yourGovernment: government,
      roadsAndIncidents: roads,
      localReporting: reporting,
      localBlindspot: blindspots, // engine output; empty -> section omitted
    },
    trafficCameras,
    comingSoonSections,
  })
}
