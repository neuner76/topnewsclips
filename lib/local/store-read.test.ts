import { describe, expect, it } from 'vitest'
import { appEventType, mapStoredEventToLocalEvent, type StoredEventRow } from './store-read'

const row: StoredEventRow = {
  id: 'e1',
  title: 'Coastal Flood Advisory',
  headline: 'Coastal Flood Advisory in effect',
  event_type: 'coastal_flood',
  status: 'developing',
  first_seen_at: '2026-09-28T12:00:00Z',
  latest_update_at: '2026-09-28T13:00:00Z',
  geo: { counties: ['Marin'] },
  consequence_score: 0.55,
  confidence: 'high',
  summary: 'Minor coastal flooding expected.',
  why_it_matters: null,
  what_changed: null,
}

describe('appEventType (spec slug → app type)', () => {
  it('maps known slugs', () => {
    expect(appEventType('coastal_flood')).toBe('flood')
    expect(appEventType('road_incident')).toBe('traffic')
    expect(appEventType('power_outage')).toBe('utility')
  })
  it('falls back to other for unknown', () => {
    expect(appEventType('mystery')).toBe('other')
  })
})

describe('mapStoredEventToLocalEvent', () => {
  it('prefers headline for title, maps type/status/confidence/geo', () => {
    const e = mapStoredEventToLocalEvent(row)
    expect(e.title).toBe('Coastal Flood Advisory in effect')
    expect(e.eventType).toBe('flood')
    expect(e.status).toBe('developing')
    expect(e.confidence).toBe('high')
    expect(e.geo.counties).toEqual(['Marin'])
    expect(e.consequenceScore).toBe(0.55)
    expect(e.sources).toEqual([])
  })
  it('uses last_seen_at for latestUpdateAt (freshness = last confirmed), falls back to latest_update_at', () => {
    expect(mapStoredEventToLocalEvent({ ...row, last_seen_at: '2026-09-28T14:30:00Z' }).latestUpdateAt).toBe('2026-09-28T14:30:00Z')
    expect(mapStoredEventToLocalEvent(row).latestUpdateAt).toBe('2026-09-28T13:00:00Z') // no last_seen_at → latest_update_at
  })
  it('defaults bad status/confidence and empty geo safely', () => {
    const e = mapStoredEventToLocalEvent({ ...row, status: 'weird', confidence: null, geo: null, headline: null })
    expect(e.title).toBe('Coastal Flood Advisory') // falls back to title
    expect(e.status).toBe('new')
    expect(e.confidence).toBe('medium')
    expect(e.geo).toEqual({})
  })
  it('parses geo delivered as a JSON string', () => {
    const e = mapStoredEventToLocalEvent({ ...row, geo: '{"cities":["Novato"]}' })
    expect(e.geo.cities).toEqual(['Novato'])
  })
})
