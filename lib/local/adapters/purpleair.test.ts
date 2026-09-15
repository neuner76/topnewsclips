import { describe, expect, it } from 'vitest'
import { pm25ToAqi, aqiCategory, normalizePurpleAir } from './purpleair'

describe('pm25ToAqi (EPA breakpoints, 2024 revision)', () => {
  it('maps clean air to a low AQI and the Good/Moderate boundary to ~50', () => {
    expect(pm25ToAqi(0)).toBe(0)
    expect(pm25ToAqi(9.0)).toBe(50) // top of Good
    expect(pm25ToAqi(35.4)).toBe(100) // top of Moderate
    expect(pm25ToAqi(55.4)).toBe(150) // top of USG
  })

  it('rises monotonically and is high for smoke-level PM2.5', () => {
    expect(pm25ToAqi(20)).toBeGreaterThan(pm25ToAqi(9))
    expect(pm25ToAqi(150)).toBeGreaterThan(200)
  })

  it('guards invalid input', () => {
    expect(pm25ToAqi(-5)).toBe(0)
    expect(pm25ToAqi(NaN)).toBe(0)
  })
})

describe('aqiCategory', () => {
  it('labels the EPA bands', () => {
    expect(aqiCategory(20)).toBe('Good')
    expect(aqiCategory(75)).toBe('Moderate')
    expect(aqiCategory(120)).toBe('Unhealthy for Sensitive Groups')
    expect(aqiCategory(350)).toBe('Hazardous')
  })
})

describe('normalizePurpleAir', () => {
  const raw = {
    fields: ['sensor_index', 'pm2.5', 'humidity', 'latitude', 'longitude'],
    data: [
      [1, 8.0, 50, 37.97, -122.53],
      [2, 12.0, 55, 37.98, -122.52],
      [3, 40.0, 45, 37.96, -122.54],
    ],
  }

  it('reduces nearby sensors to a single reading tagged PurpleAir', () => {
    const r = normalizePurpleAir(raw)
    expect(r).not.toBeNull()
    expect(r!.parameter).toBe('PM2.5')
    expect(r!.source).toBe('PurpleAir')
    expect(r!.aqi).toBeGreaterThan(0)
    expect(r!.category).toBeTruthy()
  })

  it('returns null when there are no usable sensors', () => {
    expect(normalizePurpleAir({ fields: ['pm2.5'], data: [] })).toBeNull()
    expect(normalizePurpleAir({ fields: ['sensor_index'], data: [[1]] })).toBeNull() // no pm2.5 column
  })
})
