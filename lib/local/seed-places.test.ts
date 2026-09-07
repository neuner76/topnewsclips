import { describe, expect, it } from 'vitest'
import { PUBLIC_SEED_PLACES, pointEwkt } from './seed-places'

describe('PUBLIC_SEED_PLACES', () => {
  it('has the three Build-A public places, none private', () => {
    expect(PUBLIC_SEED_PLACES.map(p => p.label)).toEqual(['Novato', 'Marin County', 'West Marin / Tomales Bay'])
    expect(PUBLIC_SEED_PLACES.every(p => p.isPrivate === false)).toBe(true)
  })

  it('has valid Bay Area coordinates and positive radii', () => {
    for (const p of PUBLIC_SEED_PLACES) {
      expect(p.latitude).toBeGreaterThan(37)
      expect(p.latitude).toBeLessThan(39)
      expect(p.longitude).toBeGreaterThan(-123.5)
      expect(p.longitude).toBeLessThan(-122)
      expect(p.radiusMiles ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('pointEwkt', () => {
  it('emits lon-lat EWKT with SRID 4326', () => {
    expect(pointEwkt(-122.5697, 38.1074)).toBe('SRID=4326;POINT(-122.5697 38.1074)')
  })
})
