import { describe, expect, it } from 'vitest'
import sample from '../../../fixtures/sources/marin-permits/sample.json'
import { normalizeMarinPermits, permitConsequence, type MarinPermitRow } from './marin-permits'

const row = (over: Partial<MarinPermitRow>): MarinPermitRow => ({
  address: '1 MAIN ST, NOVATO, CA 94945', city_town: 'NOVATO', zipcode: '94945',
  parcel_number: '000-000-00', construction_value: '10000', description: 'A permit',
  type_permit: 'RESIDENTIAL', received_date: '2026-09-08T00:00:00.000',
  latitude: '38.10', longitude: '-122.57', unique_id: 'u1', ...over,
})

describe('permitConsequence', () => {
  it('is 0 for zero/invalid valuation and scales up with value', () => {
    expect(permitConsequence(0)).toBe(0)
    expect(permitConsequence(1_000_000)).toBeCloseTo(1, 5)
    expect(permitConsequence(50_000)).toBeGreaterThan(permitConsequence(500))
  })
})

describe('normalizeMarinPermits', () => {
  it('maps a permit row to a geocoded building_permit LocalEvent', () => {
    const [e] = normalizeMarinPermits([row({ description: '26-unit residential project', construction_value: '4000000' })])
    expect(e.eventType).toBe('building_permit')
    expect(e.title).toContain('26-unit residential project')
    expect(e.geo.latitude).toBeCloseTo(38.1, 5)
    expect(e.geo.longitude).toBeCloseTo(-122.57, 5)
    expect(e.geo.cities).toContain('NOVATO')
    expect(e.geo.counties).toContain('Marin County')
    expect(e.confidence).toBe('high')
    expect(e.sources[0].type).toBe('public_record')
    expect(e.sources[0].url).toBeTruthy()
  })

  it('sorts by consequence (valuation) and caps to the limit', () => {
    const rows = [row({ unique_id: 'a', construction_value: '500' }), row({ unique_id: 'b', construction_value: '2000000' }), row({ unique_id: 'c', construction_value: '50000' })]
    const out = normalizeMarinPermits(rows, { limit: 2 })
    expect(out).toHaveLength(2)
    expect(out[0].id).toContain('b') // highest valuation first
    expect(out[1].id).toContain('c')
  })

  it('skips rows without coordinates', () => {
    expect(normalizeMarinPermits([row({ latitude: undefined, longitude: undefined })])).toHaveLength(0)
  })

  it('parses the committed live fixture without error', () => {
    const out = normalizeMarinPermits(sample as MarinPermitRow[])
    expect(out.every(e => e.eventType === 'building_permit')).toBe(true)
    expect(out.every(e => e.geo.latitude != null && e.geo.longitude != null)).toBe(true)
  })
})
