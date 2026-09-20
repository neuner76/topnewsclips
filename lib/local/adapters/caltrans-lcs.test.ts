import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { normalizeLaneClosures } from './caltrans-lcs'

const raw = JSON.parse(fs.readFileSync(path.join('fixtures', 'sources', 'caltrans-lcs', 'sample.json'), 'utf8'))
const NOVATO = { lat: 38.1074, lng: -122.5697 }
// Anchored to the fixture epochs: entry1 active, entry2 starts +12h, entry3
// ended yesterday, entry4 active but in San Jose, entry5 starts in 5 days.
const NOW = 1790000000

describe('normalizeLaneClosures', () => {
  it('keeps active + soon-starting closures near the point, drops expired / far / far-future', () => {
    const events = normalizeLaneClosures(raw, { near: NOVATO, radiusMiles: 20, lookaheadHours: 24, now: NOW })
    const ids = events.map(e => e.id)
    expect(events.length).toBe(2)
    expect(ids).toContain('caltrans-lcs-AN1') // active now, near
    expect(ids).toContain('caltrans-lcs-UN2') // starts in 12h, near
    expect(ids).not.toContain('caltrans-lcs-EN3') // ended yesterday
    expect(ids).not.toContain('caltrans-lcs-FA4') // San Jose, out of radius
    expect(ids).not.toContain('caltrans-lcs-FN5') // starts in 5 days
  })

  it('ranks a full closure above a single-lane closure and labels it', () => {
    const events = normalizeLaneClosures(raw, { near: NOVATO, radiusMiles: 20, lookaheadHours: 24, now: NOW })
    expect(events[0].id).toBe('caltrans-lcs-AN1') // Full closure ranks first
    expect(events[0].title).toContain('SR-37')
    expect(events[0].title.toLowerCase()).toContain('full')
    expect(events[0].eventType).toBe('traffic')
    expect(events[0].confidence).toBe('high')
    // single-lane closure reports the lane count in whatChanged
    const lane = events.find(e => e.id === 'caltrans-lcs-UN2')!
    expect(lane.whatChanged).toContain('1 of 3')
  })
})

describe('county filter + dedupe', () => {
  const mk = (id: string, county: string, route: string, dir: string, work: string) => ({
    lcs: {
      index: id,
      location: { travelFlowDirection: dir, begin: { beginRoute: route, beginCounty: county, beginLatitude: '38.11', beginLongitude: '-122.56' } },
      closure: {
        closureID: id, typeOfClosure: 'Lane', typeOfWork: work, lanesClosed: '1', totalExistingLanes: '2',
        closureTimestamp: { closureStartEpoch: String(NOW - 3600), closureEndEpoch: String(NOW + 3600), isClosureEndIndefinite: 'false' },
      },
    },
  })

  it('drops out-of-county closures and collapses same route+direction+work', () => {
    const raw = { data: [
      mk('a', 'Marin', 'US-101', 'North', 'Demolition'),
      mk('b', 'Marin', 'US-101', 'North', 'Demolition'), // duplicate segment of a
      mk('c', 'Napa', 'SR-29', 'North', 'Electrical Work'), // across the bay
    ] }
    const events = normalizeLaneClosures(raw, { near: NOVATO, radiusMiles: 20, counties: ['Marin', 'Sonoma'], now: NOW })
    expect(events.length).toBe(1) // duplicate collapsed, Napa dropped
    expect(events[0].title).toContain('US-101')
  })
})
