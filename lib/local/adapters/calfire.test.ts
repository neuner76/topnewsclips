import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseCalFireIncidents, normalizeCalFire } from './calfire'

const raw = JSON.parse(fs.readFileSync(path.join('fixtures', 'sources', 'calfire', 'sample.json'), 'utf8'))
const NOVATO = { lat: 38.1074, lng: -122.5697 }

describe('parseCalFireIncidents', () => {
  it('keeps active incidents with coordinates, drops extinguished/final ones', () => {
    const inc = parseCalFireIncidents(raw)
    const names = inc.map(i => i.name)
    expect(names).toContain('Chileno Fire')
    expect(names).not.toContain('Old Fire') // Final + extinguished + IsActive:false
    expect(inc.every(i => Number.isFinite(i.lat) && Number.isFinite(i.lng))).toBe(true)
  })
})

describe('normalizeCalFire', () => {
  it('surfaces a nearby active wildfire, drops fully-contained and far ones', () => {
    const events = normalizeCalFire(raw, { near: NOVATO, radiusMiles: 40 })
    expect(events.length).toBe(1) // Chileno only: Ranch is 100% contained, Timber is ~140 mi
    const fire = events[0]
    expect(fire.eventType).toBe('fire')
    expect(fire.title).toContain('Chileno Fire')
    expect(fire.title.toLowerCase()).toContain('contained')
    expect(fire.confidence).toBe('high')
    expect(fire.sources[0].url).toContain('incidents.fire.ca.gov')
  })

  it('can include contained fires when asked', () => {
    const events = normalizeCalFire(raw, { near: NOVATO, radiusMiles: 40, includeContained: true })
    expect(events.length).toBe(2) // Chileno + the 100%-contained Ranch Fire
  })
})
