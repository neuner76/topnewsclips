import { describe, expect, it } from 'vitest'
import { extractPlaces, reconcileRegion, PLACE_REGION } from './geo'

describe('extractPlaces', () => {
  it('finds named places on word boundaries', () => {
    const m = extractPlaces('Israeli drone strike hits Sidon, Lebanon').map(x => x.token)
    expect(m).toContain('lebanon')
    expect(m).toContain('sidon')
    expect(m).toContain('israeli')
  })

  it('prefers the longer token (south korea over korea)', () => {
    const m = extractPlaces('South Korea announces new policy').map(x => x.token)
    expect(m).toContain('south korea')
    expect(m).not.toContain('korea')
  })

  it('does not match substrings inside words', () => {
    // "us" must not match inside "discuss"; "india" must not match "indiana"-style words here
    const m = extractPlaces('They discuss the matter').map(x => x.token)
    expect(m).not.toContain('us')
  })
})

describe('reconcileRegion — corrects channel-derived mislabels', () => {
  it('Lebanon story tagged South Asia → corrected to Middle East (WION case)', () => {
    const r = reconcileRegion('South Asia', 'Lebanese families rebuild homes in southern Lebanon after the conflict')
    expect(r.corrected).toBe(true)
    expect(r.region).toBe('Middle East')
  })

  it('Al Jazeera Congo story tagged Middle East → corrected to Africa (DRC blindspot case)', () => {
    const r = reconcileRegion('Middle East', 'Police fire tear gas at mourners during a suspected Ebola funeral in the Democratic Republic of the Congo')
    expect(r.corrected).toBe(true)
    expect(r.region).toBe('Africa')
  })

  it('US B-52 + Russian bomber tagged South Asia → corrected away from South Asia', () => {
    const r = reconcileRegion('South Asia', 'A US Air Force B-52 crashed in California; a Russian Tu-22M3 also went down')
    expect(r.corrected).toBe(true)
    expect(r.region).not.toBe('South Asia')
    expect([null, 'Europe']).toContain(r.region) // dominant named place (California=domestic, first)
  })

  it('UK story tagged Europe → kept (region is correct; only the SECTION is wrong)', () => {
    const r = reconcileRegion('Europe', 'UK moves to ban under-16s from social media platforms')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Europe')
  })

  it('correctly-tagged Korea story → passes clean', () => {
    const r = reconcileRegion('Korea', 'South Korea unveils new semiconductor export rules in Seoul')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Korea')
  })

  it('no recognized places → keep the assigned region (cannot verify)', () => {
    const r = reconcileRegion('Europe', 'Central bank holds interest rates steady amid uncertainty')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Europe')
  })

  it('domestic US story (null region) with US places → kept domestic', () => {
    const r = reconcileRegion(null, 'Texas clinic standoff ends as Washington weighs federal response')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe(null)
  })

  it('does NOT mis-match "South America" as US/domestic (greedy-token regression)', () => {
    const places = extractPlaces('Strong El Niño emerges off the Pacific coast of South America').map(p => p.token)
    expect(places).not.toContain('america')
    // no recognized bucket → no correction, keep assigned rather than mislabel domestic
    const r = reconcileRegion('Europe', 'Strong El Niño emerges off the Pacific coast of South America')
    expect(r.region).not.toBe(null)
  })
})

describe('PLACE_REGION map', () => {
  it('maps US places to null (domestic)', () => {
    expect(PLACE_REGION['california']).toBe(null)
    expect(PLACE_REGION['washington']).toBe(null)
  })
  it('maps to existing taxonomy buckets only', () => {
    const buckets = new Set(Object.values(PLACE_REGION))
    for (const b of buckets) {
      expect([null, 'Middle East', 'Europe', 'Africa', 'South Asia', 'Japan', 'Korea', 'Australia']).toContain(b)
    }
  })
})
