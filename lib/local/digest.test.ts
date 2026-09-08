import { describe, expect, it } from 'vitest'
import { buildEnvironmentSnapshot, assembleMyLocalDigest, NEED_TO_KNOW_MAX } from './digest'
import { hasCoordinateLeak } from './privacy'
import { FIXTURE_NEED_TO_KNOW, FIXTURE_CHANGING_AROUND_YOU, FIXTURE_LOCAL_BLINDSPOT } from './fixtures'
import type { SavedPlace, LocalEvent } from './types'

const place = (label: string): SavedPlace => ({
  id: label, label, type: 'custom', latitude: 38.1, longitude: -122.57,
  radiusMiles: 5, county: 'Marin County', state: 'CA', isPrivate: false,
})

describe('buildEnvironmentSnapshot', () => {
  it('combines adapter outputs and stamps dataAsOf', () => {
    const snap = buildEnvironmentSnapshot({
      forecast: { wind: { text: 'W 18 mph', speedMph: 18, direction: 'W' }, temperatureF: 72, shortForecast: 'Sunny' },
      alerts: { alerts: [{ event: 'Heat Advisory', severity: 'Moderate', headline: 'h', area: 'Marin' }], fireRisk: { level: 'unknown', basis: 'none' } },
      quakes: [{ magnitude: 3.1, place: 'near X', time: '2026-09-07T00:00:00Z', latitude: 38, longitude: -122, distanceMiles: 4 }],
      tide: { station: '9415020', extremes: [], nextHigh: { type: 'H', time: '2026-09-07 20:16', heightFt: 6.3 } },
      airQuality: { aqi: 42, category: 'Good', parameter: 'O3' },
    })
    expect(snap.wind?.speedMph).toBe(18)
    expect(snap.airQuality?.aqi).toBe(42)
    expect(snap.activeAlerts).toHaveLength(1)
    expect(snap.recentEarthquakes).toHaveLength(1)
    expect(snap.tide?.nextHigh?.time).toBe('2026-09-07 20:16')
    expect(snap.dataAsOf).toBeTruthy()
  })
})

describe('assembleMyLocalDigest', () => {
  const base = {
    places: [place('Novato'), place('Marin County')],
    environment: null,
    sections: {
      needToKnow: FIXTURE_NEED_TO_KNOW,
      changingAroundYou: FIXTURE_CHANGING_AROUND_YOU,
      yourGovernment: [] as LocalEvent[],
      roadsAndIncidents: [] as LocalEvent[],
      localReporting: [] as LocalEvent[],
      localBlindspot: FIXTURE_LOCAL_BLINDSPOT,
    },
    fixtureSections: ['needToKnow', 'changingAroundYou', 'yourGovernment', 'roadsAndIncidents', 'localReporting', 'localBlindspot'],
  }

  it('projects places to public shape (no coordinate leak)', () => {
    const d = assembleMyLocalDigest(base)
    expect(hasCoordinateLeak(d.places)).toBe(false)
    expect(d.places.map(p => p.label)).toEqual(['Novato', 'Marin County'])
  })

  it('carries the section fixtures through and marks fixture-backed sections', () => {
    const d = assembleMyLocalDigest(base)
    expect(d.needToKnow).toHaveLength(1)
    expect(d.localBlindspot[0].id).toBe('fx-blindspot')
    expect(d.fixtureSections).toContain('needToKnow')
  })

  it('caps Need To Know at the max', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...FIXTURE_NEED_TO_KNOW[0], id: `n${i}` }))
    const d = assembleMyLocalDigest({ ...base, sections: { ...base.sections, needToKnow: many } })
    expect(d.needToKnow.length).toBe(NEED_TO_KNOW_MAX)
  })

  it('stamps generatedAt', () => {
    expect(assembleMyLocalDigest(base).generatedAt).toBeTruthy()
  })
})
