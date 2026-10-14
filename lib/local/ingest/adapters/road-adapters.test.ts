import { describe, expect, it } from 'vitest'
import { parse511TrafficItems, bay511EventToCandidate } from './bay511-events'
import { parseLcsItems, lcsItemToCandidate, lcsImpactSummary, lcsWindowText } from './caltrans-lcs'

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
    expect(a1.url).toContain('google.com/maps') // deep link to the exact spot
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
  it('content hash ignores the volatile `updated` timestamp (no churn) but reflects material changes', () => {
    const mk = (over: Record<string, unknown>) => parse511TrafficItems({ events: [
      { id: 'a1', status: 'ACTIVE', event_type: 'INCIDENT', severity: 'Major', headline: 'Crash on US-101 NB',
        created: '2026-09-28T11:30:00Z', geography: { coordinates: [-122.53, 37.97] }, roads: [{ name: 'US-101', direction: 'NB' }], ...over },
    ] })[0].contentHash
    const base = mk({ updated: '2026-09-28T12:00:00Z' })
    expect(mk({ updated: '2026-09-28T12:30:00Z' })).toBe(base) // only `updated` changed → same hash
    expect(mk({ updated: '2026-09-28T12:00:00Z', severity: 'Minor' })).not.toBe(base) // material change → new hash
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
    expect(items[0].url).toContain('google.com/maps')
  })
  it('drops other counties and already-ended closures', () => {
    const otherCounty = mk({ location: { begin: { beginCounty: 'Alameda', beginLatitude: '37.8', beginLongitude: '-122.2' }, travelFlowDirection: 'NB' } })
    const ended = mk({ closure: { closureID: 'c2', closureTimestamp: { closureEndEpoch: String(now - 3600), isClosureEndIndefinite: 'false' } } })
    expect(parseLcsItems({ data: [otherCounty] }, { nowEpoch: now })).toHaveLength(0)
    expect(parseLcsItems({ data: [ended] }, { nowEpoch: now })).toHaveLength(0)
  })
  it('trims far-north Sonoma by radius (drops Santa Rosa, keeps Petaluma)', () => {
    const santaRosa = mk({ location: { travelFlowDirection: 'NB', begin: { beginRoute: 'US-101', beginCounty: 'Sonoma', beginLatitude: '38.44', beginLongitude: '-122.71', beginNearbyPlace: 'Santa Rosa' } } })
    expect(parseLcsItems({ data: [santaRosa] }, { nowEpoch: now })).toHaveLength(0) // ~33 mi > 30
    const petaluma = mk({ location: { travelFlowDirection: 'NB', begin: { beginRoute: 'US-101', beginCounty: 'Sonoma', beginLatitude: '38.23', beginLongitude: '-122.64', beginNearbyPlace: 'Petaluma' } } })
    expect(parseLcsItems({ data: [petaluma] }, { nowEpoch: now })).toHaveLength(1) // ~18 mi, kept
  })
  it('candidate uses a deterministic route-based dedupeKey', () => {
    const cand = lcsItemToCandidate(parseLcsItems({ data: [mk()] }, { nowEpoch: now })[0])
    expect(cand.dedupeKey).toBe('caltrans-d4-lcs:us-101|nb|paving|lane')
    expect(cand.fields?.majorRoute).toBe(true)
    // impact: work · lane extent · closure window (the window is appended from the fixture's epochs)
    expect(cand.summary).toContain('Paving · 1 of 3 lanes · ')
    expect(cand.summary).toMatch(/· (from )?[A-Z][a-z]{2} /)
  })
  it('labels all-lanes-of-a-1-lane-segment as a RAMP closure, not a freeway full closure', () => {
    const ramp = mk({ closure: { closureID: 'r1', typeOfClosure: 'Full', typeOfWork: 'Electrical Work', lanesClosed: 'All', totalExistingLanes: '1',
      closureTimestamp: { closureStartEpoch: String(now - 3600), closureEndEpoch: String(now + 7200), isClosureEndIndefinite: 'false' } } })
    const item = parseLcsItems({ data: [ramp] }, { nowEpoch: now })[0]
    expect(item.title).toContain('Ramp closure')
    expect(item.title).not.toContain('Full closure')
    expect(item.extracted?.isRamp).toBe(true)
    expect(item.extracted?.isFull).toBe(false) // excluded from Need To Know (isFullClosure checks the title)
    expect(lcsItemToCandidate(item).summary).toContain('ramp/connector closed')
  })
  it('keeps a genuine MAINLINE full closure (all lanes of a multi-lane segment)', () => {
    const full = mk({ closure: { closureID: 'f1', typeOfClosure: 'Full', typeOfWork: 'Bridge Work', lanesClosed: 'All', totalExistingLanes: '3',
      closureTimestamp: { closureStartEpoch: String(now - 3600), closureEndEpoch: String(now + 7200), isClosureEndIndefinite: 'false' } } })
    const item = parseLcsItems({ data: [full] }, { nowEpoch: now })[0]
    expect(item.title).toContain('Full closure')
    expect(item.extracted?.isFull).toBe(true)
    expect(item.extracted?.isRamp).toBe(false)
    expect(lcsItemToCandidate(item).summary).toContain('all lanes')
  })
})

describe('lcsImpactSummary (Roads impact)', () => {
  it('combines work type, lane extent, and estimated delay', () => {
    expect(lcsImpactSummary({ typeOfWork: 'Paving', lanesClosed: '1', totalExistingLanes: '3' })).toBe('Paving · 1 of 3 lanes')
    expect(lcsImpactSummary({ typeOfWork: 'Pile Driving', isFull: true, estimatedDelay: '30 minutes' })).toBe('Pile Driving · all lanes · ~30 minutes delay')
    // a ramp reads "ramp/connector closed", never "all lanes" (even though lanesClosed='All')
    expect(lcsImpactSummary({ typeOfWork: 'Electrical Work', isRamp: true, lanesClosed: 'All', totalExistingLanes: '1' })).toBe('Electrical Work · ramp/connector closed')
  })
  it('omits an unreported delay', () => {
    expect(lcsImpactSummary({ typeOfWork: 'Utility', lanesClosed: '1', totalExistingLanes: '3', estimatedDelay: 'Not Reported' })).toBe('Utility · 1 of 3 lanes')
  })
  it('undefined when there is nothing to report', () => {
    expect(lcsImpactSummary({})).toBeUndefined()
  })
})


describe('lcsWindowText (closure window → honest impact signal)', () => {
  // Oct 10 2026 is a Saturday (PDT, UTC-7).
  const sat7am = Math.floor(Date.UTC(2026, 9, 10, 14, 0, 0) / 1000) // 7:00 AM PT
  const sat3pm = Math.floor(Date.UTC(2026, 9, 10, 22, 0, 0) / 1000) // 3:00 PM PT
  const fri7pm = Math.floor(Date.UTC(2026, 9, 10, 2, 0, 0) / 1000)  // Fri 7:00 PM PT
  it('same-day window uses one weekday and an en-dash', () => {
    const w = lcsWindowText(sat7am, sat3pm)
    expect(w).toContain('Sat')
    expect(w).toContain('–')
    expect(w).not.toContain('→')
  })
  it('overnight window names both days with an arrow', () => {
    const w = lcsWindowText(fri7pm, sat7am)
    expect(w).toContain('Fri')
    expect(w).toContain('Sat')
    expect(w).toContain('→')
  })
  it('open-ended closure reads "from <day time>"', () => {
    expect(lcsWindowText(sat7am, null, false)).toMatch(/^from Sat /)
    expect(lcsWindowText(sat7am, sat3pm, true)).toMatch(/^from Sat /)
  })
  it('no start → undefined', () => {
    expect(lcsWindowText(null, sat3pm)).toBeUndefined()
  })
})

describe('lcsImpactSummary appends the window', () => {
  const sat7am = Math.floor(Date.UTC(2026, 9, 10, 14, 0, 0) / 1000)
  const sat3pm = Math.floor(Date.UTC(2026, 9, 10, 22, 0, 0) / 1000)
  it('includes work, lane extent, and the closure window', () => {
    const out = lcsImpactSummary({ typeOfWork: 'Emergency Work', lanesClosed: '1', totalExistingLanes: '3', startEpoch: sat7am, endEpoch: sat3pm })
    expect(out).toContain('Emergency Work · 1 of 3 lanes · ')
    expect(out).toContain('Sat')
  })
})
