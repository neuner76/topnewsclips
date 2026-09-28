import { describe, expect, it } from 'vitest'
import { parseNwsAlertItems, nwsAlertToCandidates } from './nws-alerts'

const FIXTURE = {
  features: [
    {
      id: 'urn:oid:2.49.0.1.840.0.abc',
      properties: {
        id: 'urn:oid:2.49.0.1.840.0.abc',
        '@id': 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc',
        event: 'High Wind Warning',
        severity: 'Severe',
        headline: 'High Wind Warning until 6 PM PDT',
        description: 'Southwest winds 25 to 35 mph with gusts up to 55 mph.',
        areaDesc: 'Marin Coastal Range; North Bay Interior Valleys',
        onset: '2026-09-25T10:00:00-07:00',
        expires: '2026-09-25T18:00:00-07:00',
      },
    },
    {
      id: 'urn:oid:2.49.0.1.840.0.def',
      properties: {
        id: 'urn:oid:2.49.0.1.840.0.def',
        event: 'Coastal Flood Advisory',
        severity: 'Minor',
        headline: 'Coastal Flood Advisory in effect',
        areaDesc: 'Marin County Coast',
        onset: '2026-09-25T07:00:00-07:00',
        expires: '2026-09-25T13:00:00-07:00',
      },
    },
  ],
}

describe('parseNwsAlertItems', () => {
  it('maps each alert feature to a normalized item with a stable hash', () => {
    const items = parseNwsAlertItems(FIXTURE)
    expect(items).toHaveLength(2)
    expect(items[0].externalId).toBe('urn:oid:2.49.0.1.840.0.abc')
    expect(items[0].title).toBe('High Wind Warning')
    expect(items[0].placeText).toContain('Marin')
    expect(items[0].contentHash).toMatch(/^[0-9a-f]{32}$/)
    // hash changes when a mutable field (expires) changes
    const later = parseNwsAlertItems({ features: [{ ...FIXTURE.features[0], properties: { ...FIXTURE.features[0].properties, expires: '2026-09-25T20:00:00-07:00' } }] })
    expect(later[0].contentHash).not.toBe(items[0].contentHash)
  })

  it('ignores features without an id, and empty input', () => {
    expect(parseNwsAlertItems({ features: [{ properties: { event: 'x' } }] })).toHaveLength(0)
    expect(parseNwsAlertItems({})).toHaveLength(0)
    expect(parseNwsAlertItems(null)).toHaveLength(0)
  })
})

describe('nwsAlertToCandidates', () => {
  it('routes coastal flood alerts to coastal_flood, others to weather_alert', () => {
    const [wind, flood] = parseNwsAlertItems(FIXTURE)
    expect(nwsAlertToCandidates(wind)[0].eventType).toBe('weather_alert')
    expect(nwsAlertToCandidates(flood)[0].eventType).toBe('coastal_flood')
    const c = nwsAlertToCandidates(wind)[0]
    expect(c.dedupeKey).toBe('nws-alerts-marin:urn:oid:2.49.0.1.840.0.abc')
    expect(c.headline).toBe('High Wind Warning')
    expect(c.sourceRole).toBe('origin')
    expect(c.fields?.severity).toBe('Severe')
  })
})
