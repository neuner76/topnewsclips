// Public seed places (Build A) — centroid point + radius. These are PUBLIC place
// centroids (Novato / San Rafael as Marin's representative point / Point Reyes
// Station for West Marin), safe in source control. The private "Near Me" home is
// NOT here — it is seeded at runtime from LOCAL_HOME_LAT/LOCAL_HOME_LNG only.
//
// Boundary polygons + PostGIS containment are deferred to Build B (event
// relevance); for Build A the environment feeds query by point, so a centroid +
// radius is sufficient.
import raw from './seed-places.json'
import type { SavedPlace } from './types'

export type SeedPlace = Omit<SavedPlace, 'id'>

export const PUBLIC_SEED_PLACES: SeedPlace[] = raw as SeedPlace[]

// EWKT for a lon/lat point (text -> geometry cast on insert). Note WKT order is
// longitude first, then latitude.
export function pointEwkt(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`
}
