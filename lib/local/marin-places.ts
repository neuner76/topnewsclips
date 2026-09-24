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
