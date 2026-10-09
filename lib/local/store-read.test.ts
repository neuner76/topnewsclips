import { describe, expect, it } from 'vitest'
import { appEventType, mapStoredEventToLocalEvent, withinAnchors, isFullClosure, type StoredEventRow } from './store-read'
import type { LocalEvent } from './types'
import type { Anchor } from './anchors'

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


describe('withinAnchors (store-mode geo filter)', () => {
  // Novato center + its 6 mi radius — the anchor a shared Novato briefing passes.
  const novato: Anchor = { lat: 38.1074, lng: -122.5697, radiusMiles: 6, label: 'Novato' }

  it('no anchors → keep everything (unfiltered store-wide read)', () => {
    expect(withinAnchors({ latitude: 37.5985, longitude: -122.3872 }, [])).toBe(true)
    expect(withinAnchors({ latitude: 37.5985, longitude: -122.3872 }, undefined)).toBe(true)
  })
  it('keeps a point inside the anchor radius (central Novato)', () => {
    expect(withinAnchors({ latitude: 38.108, longitude: -122.569 }, [novato])).toBe(true)
  })
  it('drops a far point with coordinates (Millbrae, ~35 mi south — the Novato bug)', () => {
    expect(withinAnchors({ latitude: 37.5985, longitude: -122.3872 }, [novato])).toBe(false)
  })
  it('drops Sausalito (~17 mi) and Greenbrae (~10 mi) for a 6 mi Novato anchor', () => {
    expect(withinAnchors({ latitude: 37.8591, longitude: -122.4853 }, [novato])).toBe(false)
    expect(withinAnchors({ latitude: 37.9520, longitude: -122.5110 }, [novato])).toBe(false)
  })
  it('never drops a coordinate-less, county-scoped event (county-wide weather / AQI)', () => {
    expect(withinAnchors({ counties: ['Marin'] }, [novato])).toBe(true)
  })
})

describe('isFullClosure (Need To Know road promotion)', () => {
  const base: LocalEvent = {
    id: 'r1', title: '', eventType: 'road_closure', status: 'new',
    firstSeenAt: '2026-10-09T00:00:00Z', latestUpdateAt: '2026-10-09T00:00:00Z',
    geo: {}, consequenceScore: 0.5, confidence: 'high', sources: [],
  }
  it('true only for a full closure, not routine lane/emergency work', () => {
    expect(isFullClosure({ ...base, title: 'US-101 North — Full closure near Greenbrae' })).toBe(true)
    expect(isFullClosure({ ...base, title: 'US-101 South — Lane closure near Novato' })).toBe(false)
    expect(isFullClosure({ ...base, title: 'US-101 North — Emergency Work' })).toBe(false)
  })
})
