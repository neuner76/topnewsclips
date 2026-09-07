// TopNewsClips Local — coordinate privacy (Task 19).
//
// Exact coordinates exist only in env vars and rows flagged is_private. They must
// never reach a client except through the single named owner-view function (added
// with the DB layer). Everything else renders distance BANDS, and public place
// projections carry no coordinates. `hasCoordinateLeak` backs the test-suite grep
// that fails if any API response outside that one function contains a coord field.

import type { SavedPlace } from './types'

export type DistanceBand = '< 1 mi' | '1–3 mi' | '3–10 mi' | '10+ mi'

// Exact distance is never rendered in lists/analytics — only these bands.
export function distanceBand(miles: number): DistanceBand {
  if (miles < 1) return '< 1 mi'
  if (miles < 3) return '1–3 mi'
  if (miles < 10) return '3–10 mi'
  return '10+ mi'
}

// Field names that must never appear in a client-facing payload.
export const COORDINATE_FIELDS = ['lat', 'lng', 'latitude', 'longitude'] as const

const COORD_SET = new Set<string>(COORDINATE_FIELDS)

// Recursively true if any object key is a coordinate field. Used by the
// coordinate-leak test against API responses.
export function hasCoordinateLeak(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasCoordinateLeak)
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (COORD_SET.has(k)) return true
      if (hasCoordinateLeak(v)) return true
    }
  }
  return false
}

// A saved place with exact coordinates removed — safe to send to a client.
export interface PublicSavedPlace {
  id: string
  label: string
  type: SavedPlace['type']
  radiusMiles?: number
  zipCode?: string
  city?: string
  county?: string
  state?: string
}

export function toPublicPlace(place: SavedPlace): PublicSavedPlace {
  return {
    id: place.id,
    label: place.label,
    type: place.type,
    radiusMiles: place.radiusMiles,
    zipCode: place.zipCode,
    city: place.city,
    county: place.county,
    state: place.state,
  }
}
