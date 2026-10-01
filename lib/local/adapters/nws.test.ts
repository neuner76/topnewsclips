import { describe, expect, it } from 'vitest'
import { normalizeNwsForecast } from './nws'

const raw = {
  properties: {
    periods: [
      { name: 'This Afternoon', temperature: 68, temperatureUnit: 'F', isDaytime: true, windSpeed: '5 to 10 mph', windDirection: 'W', shortForecast: 'Sunny' },
      { name: 'Tonight', temperature: 52, temperatureUnit: 'F', isDaytime: false, windSpeed: '5 mph', shortForecast: 'Clear' },
      { name: 'Tuesday', temperature: 71, temperatureUnit: 'F', isDaytime: true, shortForecast: 'Sunny' },
      { name: 'Tuesday Night', temperature: 50, temperatureUnit: 'F', isDaytime: false, shortForecast: 'Clear' },
      { name: 'Wednesday', temperature: 73, temperatureUnit: 'F', isDaytime: true, shortForecast: 'Partly Sunny' },
      { name: 'Wednesday Night', temperature: 49, temperatureUnit: 'F', isDaytime: false, shortForecast: 'Clear' },
    ],
  },
}

describe('normalizeNwsForecast', () => {
  it('returns wind + top-level temp/sky (unchanged) + current + next 4 periods', () => {
    const r = normalizeNwsForecast(raw)
    expect(r.wind.speedMph).toBe(10)
    expect(r.temperatureF).toBe(68)
    expect(r.shortForecast).toBe('Sunny')
    expect(r.current).toEqual({ label: 'This Afternoon', temperatureF: 68, temperatureUnit: 'F', shortForecast: 'Sunny', isDaytime: true })
    expect(r.forecast.map(p => p.name)).toEqual(['Tonight', 'Tuesday', 'Tuesday Night', 'Wednesday'])
  })
  it('handles empty/missing periods: no current, empty forecast, wind still returned', () => {
    const r = normalizeNwsForecast({ properties: { periods: [] } })
    expect(r.current).toBeUndefined()
    expect(r.forecast).toEqual([])
    expect(r.wind).toBeDefined()
  })
})
