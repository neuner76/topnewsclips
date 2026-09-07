import { describe, expect, it } from 'vitest'
import { distanceBand, toPublicPlace, hasCoordinateLeak, COORDINATE_FIELDS } from './privacy'
import type { SavedPlace } from './types'

const home: SavedPlace = {
  id: 'home', label: 'Near Me', type: 'home',
  latitude: 38.1077, longitude: -122.5697, radiusMiles: 5,
  city: 'Novato', county: 'Marin County', state: 'CA', isPrivate: true,
}

describe('distanceBand', () => {
  it('bins exact distances into privacy bands', () => {
    expect(distanceBand(0.4)).toBe('< 1 mi')
    expect(distanceBand(1)).toBe('1–3 mi')
    expect(distanceBand(2.9)).toBe('1–3 mi')
    expect(distanceBand(3)).toBe('3–10 mi')
    expect(distanceBand(9.9)).toBe('3–10 mi')
    expect(distanceBand(10)).toBe('10+ mi')
    expect(distanceBand(42)).toBe('10+ mi')
  })
})

describe('toPublicPlace', () => {
  it('strips exact coordinates but keeps labels', () => {
    const pub = toPublicPlace(home)
    expect(pub.label).toBe('Near Me')
    expect(pub.city).toBe('Novato')
    expect(hasCoordinateLeak(pub)).toBe(false)
    // no coordinate keys at all
    for (const f of COORDINATE_FIELDS) expect(f in pub).toBe(false)
  })
})

describe('hasCoordinateLeak', () => {
  it('detects a coordinate field at any depth', () => {
    expect(hasCoordinateLeak({ id: 'x', latitude: 38.1 })).toBe(true)
    expect(hasCoordinateLeak({ id: 'x', geo: { lng: -122.5 } })).toBe(true)
    expect(hasCoordinateLeak([{ ok: true }, { lat: 1 }])).toBe(true)
  })

  it('passes a clean public object', () => {
    expect(hasCoordinateLeak(toPublicPlace(home))).toBe(false)
    expect(hasCoordinateLeak({ id: 'x', label: 'Novato', distanceBand: '1–3 mi' })).toBe(false)
  })
})
