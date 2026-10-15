import { describe, expect, it } from 'vitest'
import { aqiCategory, airNowCategory, normalizeAirNow } from './airnow'

describe('aqiCategory (AQI → band)', () => {
  it('maps the standard AirNow bands', () => {
    expect(aqiCategory(0)).toBe('Good')
    expect(aqiCategory(37)).toBe('Good')
    expect(aqiCategory(50)).toBe('Good')
    expect(aqiCategory(51)).toBe('Moderate')
    expect(aqiCategory(100)).toBe('Moderate')
    expect(aqiCategory(150)).toBe('Unhealthy for Sensitive Groups')
    expect(aqiCategory(200)).toBe('Unhealthy')
    expect(aqiCategory(300)).toBe('Very Unhealthy')
    expect(aqiCategory(400)).toBe('Hazardous')
  })
  it('is Unknown only when there is no usable number', () => {
    expect(aqiCategory(undefined)).toBe('Unknown')
    expect(aqiCategory(NaN)).toBe('Unknown')
    expect(aqiCategory(-1)).toBe('Unknown')
  })
})

describe('airNowCategory derives from AQI when the feed omits a category name', () => {
  it('uses a named category when present', () => {
    expect(airNowCategory({ AQI: 58, Category: { Name: 'Moderate' } })).toBe('Moderate')
    expect(airNowCategory({ nowcastAQI: 37, category: 'Good' })).toBe('Good')
  })
  it('falls back to the AQI band when no name is given (the "AQI 37 · Unknown" bug)', () => {
    expect(airNowCategory({ nowcastAQI: 37 })).toBe('Good')
    expect(airNowCategory({ AQI: 165 })).toBe('Unhealthy')
  })
})

describe('normalizeAirNow', () => {
  it('labels a numeric-only reading by its band, not Unknown', () => {
    const r = normalizeAirNow([{ ParameterName: 'PM2.5', nowcastAQI: 37, ReportingArea: 'San Rafael' }])
    expect(r.aqi).toBe(37)
    expect(r.category).toBe('Good')
  })
  it('returns Unknown only when there are no readings', () => {
    expect(normalizeAirNow([]).category).toBe('Unknown')
  })
})
