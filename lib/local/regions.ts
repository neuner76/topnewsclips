// Marin regions (D11) — the four regions the /local/share index groups towns by.
// D11 assigns an item to a town page only if it's within the town's radius AND in
// the same region; countywide items are exempt. This module seeds the region
// POLYGONS (so an arbitrary geocoded point can be placed in a region) and the
// point-in-polygon test. Town→region for the seeded towns already lives on
// MARIN_PLACES.region.
//
// PROVENANCE (O1): these are APPROXIMATE v1 boundaries — axis-aligned bands over
// the Marin bounding box, tuned so every seeded town centroid lands in its
// MARIN_PLACES region. The real West Marin divide is the Mt. Tam ridgeline (a
// diagonal), not a meridian; refine with a proper boundary layer (Census/OSM)
// when the DB gazetteer (`local_place`, kind='region') is populated in Phase 0.
// Bands: West = lng < -122.62; east of that, North = lat ≥ 38.05, Central =
// 37.92 ≤ lat < 38.05, Southern = lat < 37.92. Marin bbox ≈ lng[-123.05,-122.42]
// lat[37.80,38.35].
import { MARIN_PLACES } from './marin-places'

export type MarinRegion = 'North Marin' | 'Central Marin' | 'Southern Marin' | 'West Marin'

// GeoJSON ring order: [lng, lat]. Rings are closed (first point repeated).
export type GeoRing = [number, number][]

const WEST_LNG = -122.62 // ridge approximation
const NORTH_LAT = 38.05
const SOUTH_LAT = 37.92
const W = -123.05, E = -122.42, S = 37.8, N = 38.35 // Marin bounding box

export const REGION_POLYGONS: Record<MarinRegion, GeoRing> = {
  'West Marin': [[W, S], [WEST_LNG, S], [WEST_LNG, N], [W, N], [W, S]],
  'Southern Marin': [[WEST_LNG, S], [E, S], [E, SOUTH_LAT], [WEST_LNG, SOUTH_LAT], [WEST_LNG, S]],
  'Central Marin': [[WEST_LNG, SOUTH_LAT], [E, SOUTH_LAT], [E, NORTH_LAT], [WEST_LNG, NORTH_LAT], [WEST_LNG, SOUTH_LAT]],
  'North Marin': [[WEST_LNG, NORTH_LAT], [E, NORTH_LAT], [E, N], [WEST_LNG, N], [WEST_LNG, NORTH_LAT]],
}

// Standard ray-casting point-in-polygon on a [lng,lat] ring.
export function pointInRing(lng: number, lat: number, ring: GeoRing): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

// The Marin region a point falls in, or null if outside the seeded bounds.
export function regionForPoint(lat: number, lng: number): MarinRegion | null {
  for (const region of Object.keys(REGION_POLYGONS) as MarinRegion[]) {
    if (pointInRing(lng, lat, REGION_POLYGONS[region])) return region
  }
  return null
}

// The region of a seeded town (by slug), from MARIN_PLACES.
export function regionForTown(slug: string): MarinRegion | undefined {
  return MARIN_PLACES.find(p => p.slug === slug.toLowerCase())?.region as MarinRegion | undefined
}
