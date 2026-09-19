import { describe, expect, it } from 'vitest'
import { parseFirmsCsv, normalizeFirms } from './firms'

const NOVATO = { lat: 38.1074, lng: -122.5697 }

const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
38.12,-122.55,320,0.4,0.4,2026-09-19,2100,N,VIIRS,n,2.0,290,5.1,D
38.90,-121.90,340,0.4,0.4,2026-09-19,2100,N,VIIRS,h,2.0,300,8.0,D
38.11,-122.56,310,0.4,0.4,2026-09-19,2100,N,VIIRS,l,2.0,285,2.0,D`

describe('parseFirmsCsv', () => {
  it('parses detection rows and tolerates empty / header-only input', () => {
    expect(parseFirmsCsv(csv)).toHaveLength(3)
    expect(parseFirmsCsv('latitude,longitude,confidence\n')).toHaveLength(0)
    expect(parseFirmsCsv('')).toHaveLength(0)
  })
})

describe('normalizeFirms', () => {
  it('counts nominal/high-confidence detections within the radius, drops far + low-confidence', () => {
    const r = normalizeFirms(parseFirmsCsv(csv), { near: NOVATO, radiusMiles: 25 })
    // row1: ~1.5 mi, confidence n → counted; row2: ~40 mi → out; row3: near but low → out
    expect(r.count).toBe(1)
    expect(r.nearestMiles).toBeLessThan(5)
  })

  it('returns count 0 when nothing qualifies', () => {
    expect(normalizeFirms([], { near: NOVATO, radiusMiles: 25 }).count).toBe(0)
    expect(normalizeFirms([], { near: NOVATO }).nearestMiles).toBeUndefined()
  })
})
