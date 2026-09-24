// Curated Marin towns/areas for the public "pick your neighborhood" page. Each
// becomes a shareable, location-scoped briefing. Coordinates are town centers;
// radius is tuned to how spread-out the area is (dense city vs rural West Marin).
// NOTE: the permit feed is UNINCORPORATED Marin only, so "Changing Around You"
// is richest in the unincorporated (West/North Marin) areas; the other sections
// (weather, roads, fire, reporting, tides) work everywhere.
export interface MarinPlace {
  slug: string
  label: string
  lat: number
  lng: number
  radiusMiles: number
  region: 'West Marin' | 'Central Marin' | 'Southern Marin' | 'North Marin'
}

export const MARIN_PLACES: MarinPlace[] = [
  // North Marin
  { slug: 'novato', label: 'Novato', lat: 38.1074, lng: -122.5697, radiusMiles: 6, region: 'North Marin' },
  // Central Marin
  { slug: 'san-rafael', label: 'San Rafael', lat: 37.9735, lng: -122.5311, radiusMiles: 5, region: 'Central Marin' },
  { slug: 'san-anselmo', label: 'San Anselmo', lat: 37.9746, lng: -122.5616, radiusMiles: 5, region: 'Central Marin' },
  { slug: 'fairfax', label: 'Fairfax', lat: 37.9871, lng: -122.5889, radiusMiles: 6, region: 'Central Marin' },
  { slug: 'ross', label: 'Ross', lat: 37.9624, lng: -122.5550, radiusMiles: 5, region: 'Central Marin' },
  { slug: 'kentfield', label: 'Kentfield', lat: 37.9527, lng: -122.5570, radiusMiles: 5, region: 'Central Marin' },
  { slug: 'larkspur', label: 'Larkspur', lat: 37.9341, lng: -122.5350, radiusMiles: 5, region: 'Central Marin' },
  { slug: 'corte-madera', label: 'Corte Madera', lat: 37.9255, lng: -122.5275, radiusMiles: 5, region: 'Central Marin' },
  // Southern Marin
  { slug: 'mill-valley', label: 'Mill Valley', lat: 37.9060, lng: -122.5450, radiusMiles: 5, region: 'Southern Marin' },
  { slug: 'tiburon', label: 'Tiburon', lat: 37.8735, lng: -122.4566, radiusMiles: 5, region: 'Southern Marin' },
  { slug: 'sausalito', label: 'Sausalito', lat: 37.8591, lng: -122.4853, radiusMiles: 5, region: 'Southern Marin' },
  { slug: 'marin-city', label: 'Marin City', lat: 37.8688, lng: -122.5097, radiusMiles: 5, region: 'Southern Marin' },
  // West Marin
  { slug: 'point-reyes-station', label: 'Point Reyes Station', lat: 38.0697, lng: -122.8067, radiusMiles: 10, region: 'West Marin' },
  { slug: 'inverness', label: 'Inverness', lat: 38.1010, lng: -122.8569, radiusMiles: 10, region: 'West Marin' },
  { slug: 'marshall', label: 'Marshall', lat: 38.1585, lng: -122.8905, radiusMiles: 10, region: 'West Marin' },
  { slug: 'tomales', label: 'Tomales', lat: 38.2463, lng: -122.9050, radiusMiles: 10, region: 'West Marin' },
  { slug: 'nicasio', label: 'Nicasio', lat: 38.0630, lng: -122.6975, radiusMiles: 8, region: 'West Marin' },
  { slug: 'san-geronimo-valley', label: 'San Geronimo Valley', lat: 38.0130, lng: -122.6430, radiusMiles: 8, region: 'West Marin' },
  { slug: 'bolinas', label: 'Bolinas', lat: 37.9091, lng: -122.6864, radiusMiles: 8, region: 'West Marin' },
  { slug: 'stinson-beach', label: 'Stinson Beach', lat: 37.9002, lng: -122.6436, radiusMiles: 8, region: 'West Marin' },
]

export function findMarinPlace(slug: string): MarinPlace | undefined {
  return MARIN_PLACES.find(p => p.slug === slug.toLowerCase())
}

// Marin residential ZIP codes -> the nearest town in MARIN_PLACES, so a briefing
// can be reached by ZIP too (e.g. /local/share/94940). ZIPs whose exact hamlet
// isn't its own entry map to the closest listed town (Olema->Point Reyes Station,
// Dillon Beach->Tomales, the San Geronimo Valley hamlets->San Geronimo Valley).
export const MARIN_ZIP_TO_SLUG: Record<string, string> = {
  // North Marin — Novato
  '94945': 'novato', '94947': 'novato', '94948': 'novato', '94949': 'novato',
  // Central Marin
  '94901': 'san-rafael', '94903': 'san-rafael', '94912': 'san-rafael', '94913': 'san-rafael', '94915': 'san-rafael',
  '94960': 'san-anselmo', '94979': 'san-anselmo',
  '94930': 'fairfax', '94978': 'fairfax',
  '94957': 'ross',
  '94904': 'kentfield', '94914': 'kentfield',
  '94939': 'larkspur', '94977': 'larkspur',
  '94925': 'corte-madera', '94976': 'corte-madera',
  // Southern Marin
  '94941': 'mill-valley', '94942': 'mill-valley',
  '94920': 'tiburon',
  '94965': 'sausalito', '94966': 'sausalito',
  // West Marin
  '94956': 'point-reyes-station', '94950': 'point-reyes-station', // 94950 = Olema
  '94937': 'inverness',
  '94940': 'marshall',
  '94971': 'tomales', '94929': 'tomales', // 94929 = Dillon Beach
  '94946': 'nicasio',
  '94963': 'san-geronimo-valley', '94973': 'san-geronimo-valley', '94938': 'san-geronimo-valley', '94933': 'san-geronimo-valley',
  '94924': 'bolinas',
  '94970': 'stinson-beach',
}

export function findMarinPlaceByZip(zip: string): MarinPlace | undefined {
  const slug = MARIN_ZIP_TO_SLUG[zip.trim()]
  return slug ? findMarinPlace(slug) : undefined
}

// Resolve a URL segment to a Marin place: town slug OR ZIP code.
export function resolveMarinPlace(segment: string): MarinPlace | undefined {
  return findMarinPlace(segment) ?? (/^\d{5}$/.test(segment.trim()) ? findMarinPlaceByZip(segment) : undefined)
}
