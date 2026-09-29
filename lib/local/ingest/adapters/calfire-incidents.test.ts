import { describe, expect, it } from 'vitest'
import { parseCalFireItems, calfireItemToCandidate } from './calfire-incidents'

const near = { UniqueId: 'f1', Name: 'Point Reyes Fire', County: 'Marin', Location: 'near Olema',
  AcresBurned: 320, PercentContained: 20, Started: '2026-09-28T09:00:00Z', Updated: '2026-09-28T12:00:00Z',
  Latitude: 38.04, Longitude: -122.79, IsActive: true, Url: 'https://incidents.fire.ca.gov/x' }

describe('CAL FIRE ingestion', () => {
  it('keeps active in-region incidents, maps to fire_incident/place', () => {
    const items = parseCalFireItems([near])
    expect(items).toHaveLength(1)
    expect(items[0].externalId).toBe('f1')
    expect(items[0].geo?.precision).toBe('place')
    expect(items[0].extracted?.eventType).toBe('fire_incident')
    expect(items[0].title).toContain('Point Reyes Fire')
  })
  it('drops fully-contained and far-away incidents', () => {
    const contained = { ...near, UniqueId: 'f2', PercentContained: 100 }
    const farAway = { ...near, UniqueId: 'f3', Latitude: 34.05, Longitude: -118.24 } // LA
    expect(parseCalFireItems([contained])).toHaveLength(0)
    expect(parseCalFireItems([farAway])).toHaveLength(0)
  })
  it('candidate carries dedupeKey, place geo, containment fields', () => {
    const cand = calfireItemToCandidate(parseCalFireItems([near])[0])
    expect(cand.dedupeKey).toBe('calfire-incidents:f1')
    expect(cand.eventType).toBe('fire_incident')
    expect(cand.geo?.precision).toBe('place')
    expect(cand.fields?.percentContained).toBe(20)
  })
  it('re-fetch with changed containment yields a new content hash', () => {
    const a = parseCalFireItems([near])[0]
    const b = parseCalFireItems([{ ...near, PercentContained: 60, Updated: '2026-09-28T15:00:00Z' }])[0]
    expect(a.contentHash).not.toBe(b.contentHash)
  })
})
