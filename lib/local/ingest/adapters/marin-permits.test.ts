import { describe, expect, it } from 'vitest'
import { parseMarinPermitItems, marinPermitToCandidates } from './marin-permits'

const sig = {
  unique_id: 'p1', description: 'New 12-unit affordable apartment building',
  construction_value: '4200000', type_permit: 'COMMERCIAL', permit_category: 'New Construction',
  most_recent_issued_received_date: '2026-09-20T00:00:00.000', address: '123 Grant Ave',
  city_town: 'Novato', zipcode: '94945', latitude: '38.10', longitude: '-122.56',
}
const routine = {
  unique_id: 'p2', description: 'Reroof existing single-family residence',
  construction_value: '25000', type_permit: 'RESIDENTIAL', permit_category: 'Minor Improvement',
  most_recent_issued_received_date: '2026-09-21T00:00:00.000', address: '9 Elm St',
  latitude: '38.11', longitude: '-122.57',
}
const expired = { ...routine, unique_id: 'p3', description: '***Expired*** reroof' }
const nogeo = { ...sig, unique_id: 'p4', latitude: undefined, longitude: undefined }

describe('Marin permits ingestion', () => {
  it('records all non-expired, geocoded rows as items (address geo)', () => {
    const items = parseMarinPermitItems([sig, routine, expired, nogeo])
    expect(items.map(i => i.externalId).sort()).toEqual(['p1', 'p2'])
    expect(items[0].geo?.precision).toBe('address')
  })
  it('only SIGNIFICANT permits produce a candidate', () => {
    const items = parseMarinPermitItems([sig, routine])
    const sigItem = items.find(i => i.externalId === 'p1')!
    const routineItem = items.find(i => i.externalId === 'p2')!
    expect(marinPermitToCandidates(sigItem)).toHaveLength(1)
    expect(marinPermitToCandidates(routineItem)).toHaveLength(0)
  })
  it('candidate maps to development_update with valuation + dedupeKey', () => {
    const cand = marinPermitToCandidates(parseMarinPermitItems([sig])[0])[0]
    expect(cand.eventType).toBe('development_update')
    expect(cand.dedupeKey).toBe('marin-permits:p1')
    expect(cand.fields?.valuationUsd).toBe(4200000)
    expect(cand.summary).toContain('$4,200,000')
  })
})
