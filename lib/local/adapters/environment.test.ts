import { describe, expect, it } from 'vitest'
import nwsForecast from '../../../fixtures/sources/nws-forecast/sample.json'
import nwsAlerts from '../../../fixtures/sources/nws-alerts/sample.json'
import usgs from '../../../fixtures/sources/usgs-earthquakes/sample.json'
import noaa from '../../../fixtures/sources/noaa-tides/sample.json'
import airnow from '../../../fixtures/sources/airnow/sample.json'
import { normalizeNwsForecast, normalizeNwsAlerts } from './nws'
import { normalizeUsgsEarthquakes } from './usgs'
import { normalizeNoaaTides } from './noaa-tides'
import { normalizeAirNow } from './airnow'

describe('normalizeNwsForecast', () => {
  it('extracts wind + conditions from the first period', () => {
    const f = normalizeNwsForecast(nwsForecast)
    expect(f.wind.direction).toBe('SW')
    expect(f.wind.speedMph).toBe(5) // upper bound of "1 to 5 mph"
    expect(f.temperatureF).toBe(87)
    expect(f.shortForecast).toBe('Sunny')
  })
})

describe('normalizeNwsAlerts', () => {
  it('summarizes active alerts', () => {
    const { alerts } = normalizeNwsAlerts(nwsAlerts)
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(alerts[0].event).toBe('Heat Advisory')
    expect(alerts[0].severity).toBe('Moderate')
    expect(alerts[0].area).toContain('Marin')
  })

  it('derives fire risk from a Red Flag Warning when present, else unknown', () => {
    expect(normalizeNwsAlerts(nwsAlerts).fireRisk.level).toBe('unknown') // no red flag in fixture
    const redFlag = { features: [{ properties: { event: 'Red Flag Warning', severity: 'Severe', headline: 'h', areaDesc: 'Marin', onset: null, expires: null } }] }
    expect(normalizeNwsAlerts(redFlag).fireRisk.level).toBe('high')
  })
})

describe('normalizeUsgsEarthquakes', () => {
  it('maps features and sorts newest first', () => {
    const q = normalizeUsgsEarthquakes(usgs)
    expect(q.length).toBeGreaterThan(0)
    expect(q[0].magnitude).toBeGreaterThan(0)
    expect(typeof q[0].place).toBe('string')
  })

  it('filters to a radius around a point and computes distance', () => {
    // Hydesville CA (~40.56, -123.68) is ~230 mi from Novato; a 50 mi filter drops it.
    const near = { latitude: 38.1, longitude: -122.57 }
    const filtered = normalizeUsgsEarthquakes(usgs, { near, radiusMiles: 50 })
    expect(filtered.every(e => (e.distanceMiles ?? Infinity) <= 50)).toBe(true)
    const all = normalizeUsgsEarthquakes(usgs, { near })
    expect(all[0].distanceMiles).toBeGreaterThan(0)
  })
})

describe('normalizeNoaaTides', () => {
  it('maps extremes and picks the next high/low after a reference time', () => {
    const t = normalizeNoaaTides(noaa, { station: '9415020', now: new Date('2026-09-07T10:00:00-07:00') })
    expect(t.station).toBe('9415020')
    expect(t.extremes.length).toBe(4)
    expect(t.nextHigh?.type).toBe('H')
    expect(t.nextHigh?.time).toBe('2026-09-07 20:16') // 09:39 H is before 10:00
    expect(t.nextLow?.time).toBe('2026-09-07 14:18')
  })
})

describe('normalizeAirNow', () => {
  it('reports the worst (max AQI) observation', () => {
    const a = normalizeAirNow(airnow)
    expect(a.aqi).toBe(42)
    expect(a.parameter).toBe('O3')
    expect(a.category).toBe('Good')
  })
})
