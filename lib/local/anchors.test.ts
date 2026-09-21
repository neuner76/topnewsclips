import { describe, expect, it } from 'vitest'
import { nearestAnchorMiles, nearAnyAnchor, type Anchor } from './anchors'

// Two anchors: Novato (5 mi) and West Marin / Point Reyes (10 mi).
const ANCHORS: Anchor[] = [
  { lat: 38.1074, lng: -122.5697, radiusMiles: 5, label: 'Novato' },
  { lat: 38.0697, lng: -122.8067, radiusMiles: 10, label: 'West Marin' },
]

describe('nearestAnchorMiles', () => {
  it('returns the distance to the closest anchor', () => {
    expect(nearestAnchorMiles(38.11, -122.56, ANCHORS)).toBeLessThan(2) // ~Novato
    expect(nearestAnchorMiles(38.07, -122.80, ANCHORS)).toBeLessThan(1) // ~Point Reyes
    expect(nearestAnchorMiles(0, 0, [])).toBe(Infinity)
  })
})

describe('nearAnyAnchor', () => {
  it('passes a point inside any single anchor radius, using that anchor’s own radius', () => {
    // A Point Reyes permit (~0 mi from West Marin anchor) passes on the 10 mi radius,
    // even though it is ~18 mi from Novato — the old single-Novato filter dropped it.
    const pr = nearAnyAnchor(38.0697, -122.8067, ANCHORS)
    expect(pr.ok).toBe(true)
    expect(pr.anchor?.label).toBe('West Marin')

    const novato = nearAnyAnchor(38.11, -122.56, ANCHORS)
    expect(novato.ok).toBe(true)
    expect(novato.anchor?.label).toBe('Novato')
  })

  it('rejects a point outside every anchor radius (e.g. Mill Valley, Vallejo)', () => {
    // Mill Valley ~14 mi south of Novato, ~20 mi from Point Reyes — outside both.
    expect(nearAnyAnchor(37.906, -122.545, ANCHORS).ok).toBe(false)
  })

  it('honors a padMiles allowance', () => {
    // ~7 mi from Novato: outside the 5 mi radius, inside 5 + 3 pad.
    const p = { lat: 38.205, lng: -122.51 }
    expect(nearAnyAnchor(p.lat, p.lng, ANCHORS).ok).toBe(false)
    expect(nearAnyAnchor(p.lat, p.lng, ANCHORS, { padMiles: 3 }).ok).toBe(true)
  })
})
