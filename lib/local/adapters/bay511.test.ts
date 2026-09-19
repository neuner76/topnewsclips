import { describe, expect, it } from 'vitest'
import { normalize511Events } from './bay511'

const NOVATO = { lat: 38.1074, lng: -122.5697 }

const raw = {
  events: [
    {
      id: '1', status: 'ACTIVE', headline: 'US-101 southbound crash near San Marin',
      event_type: 'INCIDENT', severity: 'Moderate', updated: '2026-09-19T15:00:00Z',
      geography: { type: 'Point', coordinates: [-122.57, 38.10] }, // ~Novato
      roads: [{ name: 'US-101', direction: 'S' }],
    },
    {
      id: '2', status: 'ACTIVE', headline: 'Roadwork on I-80 in Berkeley',
      event_type: 'CONSTRUCTION', severity: 'Minor',
      geography: { type: 'Point', coordinates: [-122.27, 37.87] }, // ~30 mi away
    },
    {
      id: '3', status: 'ARCHIVED', headline: 'Cleared incident',
      event_type: 'INCIDENT', severity: 'Major',
      geography: { type: 'Point', coordinates: [-122.57, 38.10] },
    },
  ],
}

describe('normalize511Events', () => {
  it('keeps active nearby events, drops far + non-active, maps to traffic LocalEvents', () => {
    const out = normalize511Events(raw, { near: NOVATO, radiusMiles: 15 })
    expect(out).toHaveLength(1)
    const e = out[0]
    expect(e.eventType).toBe('traffic')
    expect(e.title).toContain('US-101')
    expect(e.sources[0].label).toContain('511')
    expect(e.sources[0].type).toBe('official_alert')
    expect(e.geo.counties).toContain('Marin County')
    expect(e.geo.latitude).toBeCloseTo(38.10, 2)
  })

  it('ranks higher-severity events first and caps to the limit', () => {
    const many = {
      events: [
        { id: 'a', status: 'ACTIVE', headline: 'Minor thing', event_type: 'INCIDENT', severity: 'Minor', geography: { type: 'Point', coordinates: [-122.57, 38.10] } },
        { id: 'b', status: 'ACTIVE', headline: 'Major crash', event_type: 'INCIDENT', severity: 'Major', geography: { type: 'Point', coordinates: [-122.57, 38.10] } },
      ],
    }
    const out = normalize511Events(many, { near: NOVATO, radiusMiles: 15, limit: 1 })
    expect(out).toHaveLength(1)
    expect(out[0].title).toContain('Major')
  })

  it('reads a representative point from LineString geometry', () => {
    const line = { events: [{ id: 'l', status: 'ACTIVE', headline: 'Lane closure', event_type: 'INCIDENT', severity: 'Minor', geography: { type: 'LineString', coordinates: [[-122.57, 38.10], [-122.58, 38.11]] } }] }
    expect(normalize511Events(line, { near: NOVATO, radiusMiles: 15 })).toHaveLength(1)
  })
})
