import { describe, expect, it } from 'vitest'
import { regionForPoint, regionForTown, REGION_POLYGONS, type MarinRegion } from './regions'
import { MARIN_PLACES } from './marin-places'

describe('Marin region polygons', () => {
  it('places every seeded town centroid in its MARIN_PLACES region', () => {
    for (const p of MARIN_PLACES) {
      expect(regionForPoint(p.lat, p.lng), `${p.label} (${p.lat},${p.lng})`).toBe(p.region)
    }
  })

  it('places known landmarks correctly', () => {
    expect(regionForPoint(38.0697, -122.8067)).toBe('West Marin') // Point Reyes Station
    expect(regionForPoint(37.9735, -122.5311)).toBe('Central Marin') // San Rafael
    expect(regionForPoint(38.1074, -122.5697)).toBe('North Marin') // Novato
    expect(regionForPoint(37.8591, -122.4853)).toBe('Southern Marin') // Sausalito
  })

  it('returns null well outside Marin', () => {
    expect(regionForPoint(37.7749, -122.4194)).toBeNull() // San Francisco
    expect(regionForPoint(38.4, -122.7)).toBeNull() // north of the county
  })

  it('regionForTown resolves by slug', () => {
    expect(regionForTown('marshall')).toBe('West Marin')
    expect(regionForTown('NOVATO')).toBe('North Marin')
    expect(regionForTown('nope')).toBeUndefined()
  })

  it('has four closed rings tiling the county', () => {
    const regions = Object.keys(REGION_POLYGONS) as MarinRegion[]
    expect(regions).toHaveLength(4)
    for (const r of regions) {
      const ring = REGION_POLYGONS[r]
      expect(ring[0]).toEqual(ring[ring.length - 1]) // closed
    }
  })
})
