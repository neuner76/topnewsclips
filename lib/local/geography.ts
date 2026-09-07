// TopNewsClips Local — geographic relevance (Build A, point-based).
//
// Scores how relevant a LocalEvent is to a saved place, combining point proximity
// with city/county match, weighted from lib/local/scoring.config.ts. Polygon
// containment against boundary places (Novato/Marin/ZCTA) is a PostGIS query in
// the DB layer, added with the migration — not TypeScript math here (Decisions ›
// Geography). This module covers point+radius places and the name-match signals.

import { SCORING_WEIGHTS } from './scoring.config'
import { proximityScore } from './scoring'
import type { LocalEvent, SavedPlace } from './types'

const EARTH_RADIUS_MILES = 3958.7613
const DEFAULT_RADIUS_MILES = 5

const toRad = (deg: number): number => (deg * Math.PI) / 180

// Great-circle distance in statute miles.
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)))
}

function namedMatch(values: string[] | undefined, target: string | undefined): boolean {
  if (!target || !values) return false
  const t = target.toLowerCase()
  return values.some(v => v.toLowerCase() === t)
}

// Relevance in [0, 1]: weighted sum of point proximity + city match + county
// match (weights sum to 1). Missing coordinates simply zero the proximity term,
// so a name-only event still scores on city/county.
export function scoreLocalRelevance(event: LocalEvent, savedPlace: SavedPlace): number {
  const w = SCORING_WEIGHTS.localRelevance
  const { latitude, longitude } = event.geo

  const proximity =
    latitude != null && longitude != null
      ? proximityScore(
          haversineMiles(latitude, longitude, savedPlace.latitude, savedPlace.longitude),
          savedPlace.radiusMiles ?? DEFAULT_RADIUS_MILES
        )
      : 0

  const cityMatch = namedMatch(event.geo.cities, savedPlace.city) ? 1 : 0
  const countyMatch = namedMatch(event.geo.counties, savedPlace.county) ? 1 : 0

  return w.proximity * proximity + w.cityMatch * cityMatch + w.countyMatch * countyMatch
}
