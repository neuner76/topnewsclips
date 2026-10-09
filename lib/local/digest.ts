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
  EnvironmentSnapshot, EnvironmentSources, WindReading, FireRisk, NwsAlertSummary, QuakeSummary,
  TideReading, AirQualityReading, CurrentConditions, ForecastPeriod,
} from './adapters/types'
import { normalizeNwsForecast, normalizeNwsAlerts } from './adapters/nws'
import { normalizeUsgsEarthquakes } from './adapters/usgs'
import { normalizeNoaaTides } from './adapters/noaa-tides'
import { normalizeAirNow } from './adapters/airnow'
import { fetchPurpleAir } from './adapters/purpleair'
import { fetchFirms } from './adapters/firms'
import { buildNeedToKnow } from './need-to-know'
import { fetchCalFire } from './adapters/calfire'
import { type Anchor } from './anchors'
import { PUBLIC_SEED_PLACES } from './seed-places'
import { sectionSource, type LocalSectionKey } from './config'
import { readRoadsStore, readNeedToKnowStore } from './store-read'
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
  coverageAreas: string[] // the tight saved-place areas that actually drive filtering (e.g. Novato, West Marin)
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
  forecast?: { wind: WindReading; temperatureF?: number; shortForecast?: string; current?: CurrentConditions; forecast?: ForecastPeriod[] }
  alerts?: { alerts: NwsAlertSummary[]; fireRisk: FireRisk }
  quakes?: QuakeSummary[]
  tide?: TideReading
  airQuality?: AirQualityReading
  thermalAnomalies?: { count: number; nearestMiles?: number }
}

export function buildEnvironmentSnapshot(parts: SnapshotParts): EnvironmentSnapshot {
  return {
    wind: parts.forecast?.wind,
    weather: parts.forecast
      ? { current: parts.forecast.current, forecast: parts.forecast.forecast ?? [] }
      : undefined,
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
  coverageAreas?: string[]
  comingSoonSections: string[]
  generatedAt?: string
}

export function assembleMyLocalDigest(input: AssembleInput): MyLocalDigest {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    places: input.places.map(toPublicPlace),
    coverageAreas: input.coverageAreas ?? [],
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
  // All six readings are independent — fetch them concurrently, not one-by-one.
  const [forecast, alerts, quakes, tide, airQuality, thermalAnomalies] = await Promise.all([
    safe(async () => {
      // Resolve the forecast gridpoint for THIS point (so a shared location gets
      // its own weather, not Novato's); fall back to the default San Rafael grid.
      const resolved = await safe(async () => {
        const r = await fetch(`https://api.weather.gov/points/${point.lat},${point.lng}`, { headers: { 'User-Agent': UA } })
        if (!r.ok) throw new Error(`points ${r.status}`)
        return (await r.json())?.properties?.forecast as string | undefined
      })
      const forecastUrl = resolved || 'https://api.weather.gov/gridpoints/MTR/83,121/forecast'
      const res = await fetch(forecastUrl, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`forecast ${res.status}`)
      return normalizeNwsForecast(await res.json())
    }),
    safe(async () => {
      const res = await fetch(`https://api.weather.gov/alerts/active?point=${point.lat},${point.lng}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`alerts ${res.status}`)
      return normalizeNwsAlerts(await res.json())
    }),
    safe(async () => {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`usgs ${res.status}`)
      return normalizeUsgsEarthquakes(await res.json(), { near: { latitude: point.lat, longitude: point.lng }, radiusMiles: 100 })
    }),
    safe(async () => {
      const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${TIDE_STATION}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json`
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`tides ${res.status}`)
      return normalizeNoaaTides(await res.json(), { station: TIDE_STATION, now: new Date() })
    }),
    resolveAirQuality(point),
    process.env.NASA_FIRMS_MAP_KEY ? safe(() => fetchFirms(point, process.env.NASA_FIRMS_MAP_KEY!)) : Promise.resolve(undefined),
  ])
  return { ...buildEnvironmentSnapshot({ forecast, alerts, quakes, tide, airQuality, thermalAnomalies }), sources: environmentSources(point, airQuality) }
}

// Direct-source links for each environment reading — location-specific where the
// provider supports it (NWS point forecast, NOAA tide station).
function environmentSources(point: { lat: number; lng: number }, airQuality?: AirQualityReading): EnvironmentSources {
  const nws = `https://forecast.weather.gov/MapClick.php?lat=${point.lat}&lon=${point.lng}`
  const aq = (airQuality?.source ?? '').toLowerCase().includes('purpleair')
    ? 'https://map.purpleair.com/'
    : 'https://www.airnow.gov/'
  return {
    wind: nws,
    fireRisk: nws,
    alerts: nws,
    airQuality: aq,
    tide: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${TIDE_STATION}`,
    thermalAnomalies: 'https://firms.modaps.eosdis.nasa.gov/map/',
    earthquakes: 'https://earthquake.usgs.gov/earthquakes/map/',
  }
}

// Air quality: prefer AirNow (official EPA monitors); fall back to PurpleAir
// (crowd sensors) when AirNow is unavailable or returns no usable observation
// near the point. Each source is only tried if its key is configured.
async function resolveAirQuality(point: { lat: number; lng: number }): Promise<AirQualityReading | undefined> {
  const airnow = process.env.AIRNOW_API_KEY
    ? await safe(async () => {
        const url = `https://www.airnowapi.org/aq/observation/current/ziplatlong/?format=application/json&latitude=${point.lat}&longitude=${point.lng}&distance=25&API_KEY=${process.env.AIRNOW_API_KEY}`
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

// A shared, location-scoped build (public share link): center on `point`, use a
// single `anchor` for that place, DON'T read/expose the owner's saved places,
// and DON'T spend the owner's LLM key on public traffic.
export interface LocalBuildContext {
  point: { lat: number; lng: number }
  anchors: Anchor[]
  coverageAreas: string[]
}

// Everything the section resolvers read, fetched ONCE and concurrently — this is
// the shared "live" data load. Owner mode reads saved places + runs the LLM
// extraction; shared/public mode does neither. A failed fetch yields an empty
// slice (its section renders empty), never fabricated data.
async function loadLocalInputs(ctx?: LocalBuildContext) {
  const shared = !!ctx
  const point = ctx?.point ?? representativePoint()
  const apiKey = shared ? undefined : process.env.ANTHROPIC_API_KEY

  // Places + anchors first (fast DB reads); everything downstream needs anchors.
  const [places, anchors] = await Promise.all([
    shared ? Promise.resolve([] as SavedPlace[]) : getSavedPlaces(),
    ctx?.anchors ? Promise.resolve(ctx.anchors) : getPlaceAnchors(),
  ])

  const agendasP = safe(() => fetchMarinAgendas(5))
  const [
    environment, changingPermits, agendas, articles, coverageArticlesRaw, permitPool,
    roads511, closures, trafficCameras, wildfires, agendaItems,
  ] = await Promise.all([
    buildLiveEnvironment(point),
    safe(() => fetchMarinPermits(6, 'consequence', { anchors, significantOnly: true })).then(r => r ?? []),
    agendasP,
    safe(() => fetchLocalNews()).then(r => r ?? []),
    safe(() => fetchCoverageArticles()),
    safe(() => fetchMarinPermits(50, 'consequence')).then(r => r ?? []),
    process.env.BAY511_API_KEY
      ? safe(() => fetch511Events(process.env.BAY511_API_KEY!, point, { anchors })).then(r => r ?? [])
      : Promise.resolve([] as LocalEvent[]),
    safe(() => fetchCaltransClosures(point, { anchors, counties: ['Marin', 'Sonoma'] })).then(r => r ?? []),
    safe(() => fetchCaltransCameras(point, { anchors })).then(r => r ?? []),
    safe(() => fetchCalFire({ anchors, near: point, radiusMiles: 40 })).then(r => r ?? []),
    // LLM agenda extraction chains off the agendas fetch, still concurrently.
    apiKey
      ? agendasP.then(a => a ? safe(() => buildAgendaItemEvents(a, apiKey)).then(r => r ?? []) : ([] as LocalEvent[]))
      : Promise.resolve([] as LocalEvent[]),
  ])

  return {
    point, anchors, places,
    // Tight anchors are the areas actually driving filtering — surface their labels.
    coverageAreas: ctx ? ctx.coverageAreas : anchors.map(a => a.label).filter((l): l is string => !!l),
    environment, changingPermits, agendas, agendaItems, articles,
    coverageArticles: coverageArticlesRaw ?? articles,
    permitPool, roads511, closures, trafficCameras, wildfires,
  }
}
type LocalInputs = Awaited<ReturnType<typeof loadLocalInputs>>

// --- Per-section LIVE resolvers (pure transforms over the loaded inputs) ---
// Each is the "live" arm of one briefing section; the "store" arm slots in behind
// resolveSection (D1) without touching these.

function resolveChanging(i: LocalInputs): LocalEvent[] { return i.changingPermits }
function resolveEnvironment(i: LocalInputs): EnvironmentSnapshot { return i.environment }
function resolveCameras(i: LocalInputs): LocalCamera[] { return i.trafficCameras }

function resolveReporting(i: LocalInputs): LocalEvent[] {
  // Hard-filter to Marin: local weeklies pass; regional outlets (KQED) only when
  // the story names a Marin/Novato place.
  return i.articles.filter(isLocalToMarin).slice(0, 6).map(articleToLocalEvent)
}

function resolveRoads(i: LocalInputs): LocalEvent[] {
  // Live 511 incidents merged with Caltrans D4 closures, ranked and capped.
  return [...i.roads511, ...i.closures].sort((a, b) => (b.consequenceScore ?? 0) - (a.consequenceScore ?? 0)).slice(0, 8)
}

function resolveBlindspot(i: LocalInputs): LocalEvent[] {
  // MAJOR public records (>= ~$250k) not covered by the local outlets we track.
  const blindspotPool = [...i.permitPool, ...i.agendaItems]
  const outletsChecked = COVERAGE_OUTLET_NAMES.join(', ')
  return selectLocalBlindspots(
    blindspotPool.map(e => ({ event: e, localMediaOutlets: detectLocalCoverage(e, i.coverageArticles) })),
    { minConsequence: 0.9, limit: 3 },
  ).map(b => ({
    ...b.event,
    whyItMatters: `${b.event.whatChanged ? b.event.whatChanged + ' · ' : ''}${b.localMediaOutlets === 0 ? `Not found in the local outlets we track (${outletsChecked}).` : `Covered by only ${b.localMediaOutlets} of the local outlets we track (${outletsChecked}).`}`,
  }))
}

function resolveGovernment(i: LocalInputs, blindspots: LocalEvent[]): LocalEvent[] {
  // Consequential extracted decisions, EXCLUDING anything the Blindspot surfaced.
  return selectGovernmentEvents(i.agendaItems, i.agendas ?? [], GOVERNMENT_MAX, new Set(blindspots.map(b => b.id)))
}

function resolveNeedToKnow(i: LocalInputs, environment: EnvironmentSnapshot, roads: LocalEvent[]): LocalEvent[] {
  // The urgent, act-now subset synthesized from NWS alerts, CAL FIRE wildfires,
  // nearby quakes, fire detections and full closures. Empty is honest.
  return buildNeedToKnow(environment, roads, { near: i.point, wildfires: i.wildfires })
}

// D1 dispatch: a section is served by the store OR live-computes, never both. The
// store arm throws until it's wired — flip a flag to 'store' in lib/local/config
// only once that section's store read exists.
// D1 strangler seam. A section flagged 'store' is served from the event store
// (readPublishedEvents); 'live' runs the fetch-on-request path. Never both (D1).
// A 'store'-flagged section MUST supply a `store` reader, else we fail loudly
// rather than silently serve stale/empty data.
async function resolveSection<T>(
  key: LocalSectionKey,
  live: () => T | Promise<T>,
  store?: () => Promise<T>,
): Promise<T> {
  if (sectionSource(key) === 'store') {
    if (!store) {
      throw new Error(`Local section "${key}" is flagged 'store' but no store reader is wired (D1). Add one in buildMyLocalDigest or set it back to 'live' in lib/local/config.`)
    }
    // Store-first, live-fallback: a 'store' flag turned on before the store is
    // populated (or a transient DB error) must never take down /local. This is
    // error recovery, not dual-sourcing — the happy path serves the store alone.
    try {
      return await store()
    } catch (e) {
      console.warn(`[local] store read for "${key}" failed; falling back to live:`, e instanceof Error ? e.message : e)
      return live()
    }
  }
  return live()
}

export async function buildMyLocalDigest(ctx?: LocalBuildContext): Promise<MyLocalDigest> {
  const inputs = await loadLocalInputs(ctx)
  const sb = getServiceClient()

  // Each section goes through the store/live flag. Order respects dependencies:
  // blindspot before government; environment + roads before Need To Know.
  const environment = await resolveSection('environment', () => resolveEnvironment(inputs))
  const changing = await resolveSection('changingAroundYou', () => resolveChanging(inputs))
  const trafficCameras = await resolveSection('trafficCameras', () => resolveCameras(inputs))
  const reporting = await resolveSection('localReporting', () => resolveReporting(inputs))
  const roads = await resolveSection(
    'roadsAndIncidents',
    () => resolveRoads(inputs),
    () => readRoadsStore(sb, { limit: 8, anchors: inputs.anchors }),
  )
  const blindspots = await resolveSection('localBlindspot', () => resolveBlindspot(inputs))
  const government = await resolveSection('yourGovernment', () => resolveGovernment(inputs, blindspots))
  const needToKnow = await resolveSection(
    'needToKnow',
    () => resolveNeedToKnow(inputs, environment, roads),
    () => readNeedToKnowStore(sb, { limit: NEED_TO_KNOW_MAX, anchors: inputs.anchors }),
  )

  // A closure promoted into Need To Know shouldn't repeat in Roads & Incidents.
  const ntkIds = new Set(needToKnow.map(e => e.id))
  const roadsDeduped = roads.filter(e => !ntkIds.has(e.id))

  return assembleMyLocalDigest({
    places: inputs.places,
    environment,
    sections: {
      needToKnow,
      changingAroundYou: changing,
      yourGovernment: government,
      roadsAndIncidents: roadsDeduped,
      localReporting: reporting,
      localBlindspot: blindspots, // engine output; empty -> section omitted
    },
    trafficCameras,
    coverageAreas: inputs.coverageAreas,
    comingSoonSections: [], // no section is a "coming soon" placeholder anymore
  })
}
