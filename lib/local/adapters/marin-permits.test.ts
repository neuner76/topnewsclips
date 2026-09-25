import { describe, expect, it } from 'vitest'
import sample from '../../../fixtures/sources/marin-permits/sample.json'
import { normalizeMarinPermits, permitConsequence, permitDetailUrl, permitDetailFields, type MarinPermitRow } from './marin-permits'

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

describe('permitDetailUrl', () => {
  it('links to our in-app detail route keyed on unique_id', () => {
    expect(permitDetailUrl('OM_94521')).toBe('/local/permit/OM_94521')
    // ids with URL-special chars are encoded
    expect(permitDetailUrl('IN_B4/8455')).toBe('/local/permit/IN_B4%2F8455')
  })
  it('falls back to the dataset page when there is no unique_id', () => {
    expect(permitDetailUrl(undefined)).toBe('https://data.marincounty.gov/County-Government/Building-Permit/mkbn-caye')
    expect(permitDetailUrl('')).not.toContain('/local/permit/')
  })
})

describe('permitDetailFields', () => {
  it('maps a raw row to display fields, cleaning the title and date', () => {
    const d = permitDetailFields(row({
      unique_id: 'OM_94521', permit_number: '', permit_tracking_id: '94521',
      description: 'New Construction Of An Aircraft Hanger', construction_value: '300000',
      type_permit: 'COMMERCIAL', permit_category: 'All other Construction', parcel_number: '125-190-54',
      contractor: 'KASTEN BUILDERS',
      most_recent_issued_received_date: '2026-09-18T00:00:00.000', address: '451 AIRPORT RD, NOVATO, CA 94945',
    }))
    expect(d.uniqueId).toBe('OM_94521')
    expect(d.permitNumber).toBeUndefined() // tracking id is NOT the public permit number — never shown
    expect(d.parcelNumber).toBe('125-190-54') // APN is the reliable county-lookup key
    expect(d.contractor).toBe('Kasten Builders') // title-cased contractor name
    expect(d.title).toContain('Aircraft Hanger')
    expect(d.valuationUsd).toBe(300000)
    expect(d.dateLabel).toBe('2026-09-18')
    expect(d.address).toContain('Novato')
  })

  it('shows the real permit number when present (simple permits)', () => {
    expect(permitDetailFields(row({ permit_number: 'B44461' })).permitNumber).toBe('B44461')
  })

  it('treats an implausible construction_value as unknown (county data errors)', () => {
    // $173M for a "751 sq ft addition" is a real data-entry error in the dataset.
    const bad = permitDetailFields(row({ construction_value: '173456950', description: '(N) 751 Sf Addition' }))
    expect(bad.valuationUsd).toBeUndefined()
    // and it must not top the ranking / become a blindspot
    const [e] = normalizeMarinPermits([row({ construction_value: '173456950' })])
    expect(e.amountUsd).toBeUndefined()
    expect(e.consequenceScore).toBe(0)
  })
})

describe('normalizeMarinPermits', () => {
  it('links each permit to its own in-app detail page (by unique_id)', () => {
    const [e] = normalizeMarinPermits([row({ unique_id: 'OM_94521' })])
    expect(e.sources[0].url).toBe('/local/permit/OM_94521')
  })

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

  it('reads the date from most_recent_issued_received_date (received/issued columns are empty)', () => {
    // Real dataset shape: received_date/issued_date are null; only the combined field is set.
    const [e] = normalizeMarinPermits([
      row({ received_date: null, issued_date: null, most_recent_issued_received_date: '2026-09-18T00:00:00.000' }),
    ])
    expect(e.latestUpdateAt).toBe('2026-09-18T00:00:00.000')
    expect(e.firstSeenAt).toBe('2026-09-18T00:00:00.000')
    expect(e.whatChanged).toContain('Permit issued')
  })

  it('with `near`+radius, keeps only permits in range and notes the distance', () => {
    const NOVATO = { lat: 38.1074, lng: -122.5697 }
    const rows = [
      row({ unique_id: 'near', latitude: '38.11', longitude: '-122.56', construction_value: '20000' }), // ~1 mi
      row({ unique_id: 'far', latitude: '37.906', longitude: '-122.545', construction_value: '9000000' }), // Mill Valley ~14 mi, huge $
    ]
    const out = normalizeMarinPermits(rows, { near: NOVATO, radiusMiles: 10 })
    expect(out).toHaveLength(1) // the far high-dollar permit is filtered out despite its value
    expect(out[0].id).toContain('near')
    expect(out[0].whatChanged).toMatch(/mi away/)
  })

  it('drops expired permits — they are not "changing around you"', () => {
    const rows = [
      row({ unique_id: 'live', description: 'Replace 1 Window & 1 Door', construction_value: '20000' }),
      row({ unique_id: 'exp1', description: 'Rplc 1 Window In Kind ***Expired', construction_value: '700' }),
      row({ unique_id: 'exp2', description: 'Ev Charging Permit W/E-Inspection ***EXPIRED', construction_value: '1800' }),
    ]
    const out = normalizeMarinPermits(rows)
    expect(out).toHaveLength(1)
    expect(out[0].id).toContain('live')
  })

  it('cleans raw permit-clerk shorthand and fixes state/zip casing', () => {
    const [e] = normalizeMarinPermits([
      row({ description: 'Rplc 1 Window In Kind', address: '26 MAIN DOCK, SAUSALITO, CA 94965' }),
    ])
    expect(e.title).toContain('Replace') // Rplc -> Replace
    expect(e.title).not.toContain('Rplc')
    expect(e.whatChanged).toContain('CA 94965') // state code stays uppercase, not "Ca"
    expect(e.whatChanged).not.toMatch(/\bCa 9/) // not the mangled "Ca 94965"
  })

  it('parses the committed live fixture without error', () => {
    const out = normalizeMarinPermits(sample as MarinPermitRow[])
    expect(out.every(e => e.eventType === 'building_permit')).toBe(true)
    expect(out.every(e => e.geo.latitude != null && e.geo.longitude != null)).toBe(true)
  })
})
