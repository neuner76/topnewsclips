import { describe, expect, it } from 'vitest'
import { parseAirNowItems, airnowItemToCandidates } from './airnow'

const obs = (aqi: number, cat: string) => ([
  { ParameterName: 'PM2.5', AQI: aqi, Category: { Name: cat }, ReportingArea: 'San Rafael', Latitude: 37.97, Longitude: -122.53, DateObserved: '2026-09-29', HourObserved: 14 },
  { ParameterName: 'O3', AQI: aqi - 20, Category: { Name: 'Good' }, ReportingArea: 'San Rafael' },
])

describe('AirNow ingestion', () => {
  it('records the worst reading as one county-level item', () => {
    const items = parseAirNowItems(obs(58, 'Moderate'))
    expect(items).toHaveLength(1)
    expect(items[0].extracted?.aqi).toBe(58)
    expect(items[0].geo?.precision).toBe('county')
    expect(items[0].title).toContain('AQI 58')
  })
  it('returns nothing when AirNow has no numeric readings', () => {
    expect(parseAirNowItems([{ ParameterName: 'PM2.5' }])).toHaveLength(0)
    expect(parseAirNowItems([])).toHaveLength(0)
  })
  it('no event below the alert threshold (Good/Moderate)', () => {
    expect(airnowItemToCandidates(parseAirNowItems(obs(58, 'Moderate'))[0])).toHaveLength(0)
    expect(airnowItemToCandidates(parseAirNowItems(obs(100, 'Moderate'))[0])).toHaveLength(0)
  })
  it('emits an air_quality event at/above 101 (Unhealthy for Sensitive Groups)', () => {
    const cand = airnowItemToCandidates(parseAirNowItems(obs(158, 'Unhealthy'))[0])
    expect(cand).toHaveLength(1)
    expect(cand[0].eventType).toBe('air_quality')
    expect(cand[0].dedupeKey).toBe('airnow-marin:San Rafael')
    expect(cand[0].fields?.aqi).toBe(158)
    expect(cand[0].geo?.precision).toBe('county')
  })
  it('a changed AQI yields a new content hash (→ event update)', () => {
    const a = parseAirNowItems(obs(158, 'Unhealthy'))[0]
    const b = parseAirNowItems(obs(180, 'Unhealthy'))[0]
    expect(a.contentHash).not.toBe(b.contentHash)
  })
})
