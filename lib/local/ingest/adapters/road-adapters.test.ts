import { describe, expect, it } from 'vitest'
import { parse511TrafficItems, bay511EventToCandidate } from './bay511-events'
import { parseLcsItems, lcsItemToCandidate } from './caltrans-lcs'

describe('511 traffic ingestion', () => {
  const body = {
    events: [
      { id: 'a1', status: 'ACTIVE', event_type: 'INCIDENT', severity: 'Major', headline: 'Crash on US-101 NB',
        updated: '2026-09-28T12:00:00Z', created: '2026-09-28T11:30:00Z',
        geography: { coordinates: [-122.53, 37.97] }, roads: [{ name: 'US-101', direction: 'NB' }] },
      { id: 'far', status: 'ACTIVE', event_type: 'INCIDENT', geography: { coordinates: [-121.9, 37.3] } }, // San Jose — out of region
      { id: 'archived', status: 'ARCHIVED', geography: { coordinates: [-122.53, 37.97] } },
      { id: 'con1', status: 'ACTIVE', event_type: 'CONSTRUCTION', headline: 'Lane work on Sir Francis Drake',
        updated: '2026-09-28T12:00:00Z', geography: { coordinates: [-122.6, 38.0] }, roads: [{ name: 'Sir Francis Drake Blvd' }] },
    ],
  }
  it('keeps active, in-region events and maps type/major-route', () => {
    const items = parse511TrafficItems(body)
    expect(items.map(i => i.externalId).sort()).toEqual(['a1', 'con1'])
    const a1 = items.find(i => i.externalId === 'a1')!
    expect(a1.geo?.precision).toBe('segment')
    expect(a1.extracted?.eventType).toBe('road_incident')
    expect(a1.extracted?.majorRoute).toBe(true) // US-101
    const con = items.find(i => i.externalId === 'con1')!
    expect(con.extracted?.eventType).toBe('road_closure') // CONSTRUCTION
    expect(con.extracted?.majorRoute).toBe(true) // Sir Francis Drake
  })
  it('candidate carries dedupeKey, geo, and severity/majorRoute fields', () => {
    const cand = bay511EventToCandidate(parse511TrafficItems(body)[0])
    expect(cand.dedupeKey).toMatch(/^511-traffic-events:/)
    expect(cand.eventType).toBe('road_incident')
    expect(cand.geo?.precision).toBe('segment')
    expect(cand.fields?.majorRoute).toBe(true)
  })
})

describe('Caltrans LCS ingestion', () => {
  const now = Math.floor(Date.parse('2026-09-28T12:00:00Z') / 1000)
  const mk = (over: Record<string, unknown> = {}) => ({
    lcs: {
      index: '1',
      location: { travelFlowDirection: 'NB', begin: {
        beginRoute: 'US-101', beginCounty: 'Marin', beginLatitude: '37.99', beginLongitude: '-122.52',
        beginNearbyPlace: 'Novato', beginFreeFormDescription: 'at Rowland Blvd' } },
      closure: { closureID: 'c1', typeOfClosure: 'Lane', typeOfWork: 'Paving', lanesClosed: '1', totalExistingLanes: '3',
        closureTimestamp: { closureStartEpoch: String(now - 3600), closureEndEpoch: String(now + 7200), isClosureEndIndefinite: 'false' } },
      ...over,
    },
  })
  it('keeps in-county, in-window closures and maps to road_closure w/ major route', () => {
    const items = parseLcsItems({ data: [mk()] }, { nowEpoch: now })
    expect(items).toHaveLength(1)
    expect(items[0].extracted?.eventType).toBe('road_closure')
    expect(items[0].extracted?.majorRoute).toBe(true)
    expect(items[0].geo?.precision).toBe('segment')
    expect(items[0].title).toContain('US-101')
  })
  it('drops other counties and already-ended closures', () => {
    const otherCounty = mk({ location: { begin: { beginCounty: 'Alameda', beginLatitude: '37.8', beginLongitude: '-122.2' }, travelFlowDirection: 'NB' } })
    const ended = mk({ closure: { closureID: 'c2', closureTimestamp: { closureEndEpoch: String(now - 3600), isClosureEndIndefinite: 'false' } } })
    expect(parseLcsItems({ data: [otherCounty] }, { nowEpoch: now })).toHaveLength(0)
    expect(parseLcsItems({ data: [ended] }, { nowEpoch: now })).toHaveLength(0)
  })
  it('candidate uses a deterministic route-based dedupeKey', () => {
    const cand = lcsItemToCandidate(parseLcsItems({ data: [mk()] }, { nowEpoch: now })[0])
    expect(cand.dedupeKey).toBe('caltrans-d4-lcs:us-101|nb|paving|lane')
    expect(cand.fields?.majorRoute).toBe(true)
  })
})
