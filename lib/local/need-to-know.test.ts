import { describe, expect, it } from 'vitest'
import { buildNeedToKnow } from './need-to-know'
import type { EnvironmentSnapshot } from './adapters/types'
import type { LocalEvent } from './types'

const NOVATO = { lat: 38.1074, lng: -122.5697 }
const NOW = 1790000000

const emptyEnv: EnvironmentSnapshot = { activeAlerts: [], recentEarthquakes: [], dataAsOf: new Date(NOW * 1000).toISOString() }

function fullClosure(id: string): LocalEvent {
  return {
    id, title: 'SR-37 West — Full closure near Novato', eventType: 'traffic', status: 'new',
    firstSeenAt: new Date(NOW * 1000).toISOString(), latestUpdateAt: new Date(NOW * 1000).toISOString(),
    geo: { latitude: 38.11, longitude: -122.56, counties: ['Marin County'] },
    consequenceScore: 0.7, confidence: 'high',
    sources: [{ type: 'official_alert', label: 'Caltrans QuickMap', url: 'https://quickmap.dot.ca.gov/', observedAt: new Date(NOW * 1000).toISOString(), status: 'confirmed' }],
  }
}

describe('buildNeedToKnow', () => {
  it('is empty when nothing urgent is happening', () => {
    expect(buildNeedToKnow(emptyEnv, [], { near: NOVATO, now: NOW })).toEqual([])
  })

  it('promotes severe NWS alerts and ranks them above lesser signals', () => {
    const env: EnvironmentSnapshot = {
      ...emptyEnv,
      activeAlerts: [
        { event: 'Flood Warning', severity: 'Severe', headline: 'Flood Warning until 6 PM', area: 'Marin County' },
        { event: 'Small Craft Advisory', severity: 'Minor', headline: 'winds to 20 kt', area: 'SF Bay' }, // filtered out
      ],
      recentEarthquakes: [{ magnitude: 4.2, place: '5km W of Novato', time: new Date(NOW * 1000).toISOString(), latitude: 38.1, longitude: -122.6, distanceMiles: 6 }],
    }
    const ntk = buildNeedToKnow(env, [fullClosure('c1')], { near: NOVATO, now: NOW })
    // flood warning + quake + full closure = 3; the minor advisory is dropped
    expect(ntk.length).toBe(3)
    expect(ntk[0].eventType).toBe('flood') // severe alert ranks first
    expect(ntk[0].title).toContain('Flood Warning')
    expect(ntk.some(e => e.eventType === 'earthquake')).toBe(true)
    expect(ntk.some(e => e.title.includes('Full closure'))).toBe(true)
  })

  it('surfaces nearby active fire detections but ignores distant/small quakes', () => {
    const env: EnvironmentSnapshot = {
      ...emptyEnv,
      thermalAnomalies: { count: 3, nearestMiles: 8 },
      recentEarthquakes: [{ magnitude: 2.8, place: 'far away', time: new Date(NOW * 1000).toISOString(), latitude: 39, longitude: -123, distanceMiles: 80 }],
    }
    const ntk = buildNeedToKnow(env, [], { near: NOVATO, now: NOW })
    expect(ntk.length).toBe(1) // fire detection only; the M2.8 @ 80mi is ignored
    expect(ntk[0].eventType).toBe('fire')
    expect(ntk[0].title.toLowerCase()).toContain('fire')
  })
})
