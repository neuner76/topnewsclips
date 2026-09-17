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

  it('recognizes bare continent/region names, not just specific countries', () => {
    expect(extractPlaces('Flash floods strike Europe as rains trigger rescues').map(x => x.region)).toContain('Europe')
    expect(extractPlaces('The US considered leaving the Middle East entirely').map(x => x.region)).toContain('Middle East')
    expect(extractPlaces('Drought grips the Horn of Africa this year').map(x => x.region)).toContain('Africa')
  })

  it('does not mis-match "African American" (US demographic) as Africa', () => {
    const regions = extractPlaces('African American voters shape the Georgia runoff').map(x => x.region)
    expect(regions).not.toContain('Africa')
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

  it('continent-level Europe story tagged Europe → kept (no country named, but "Europe" is)', () => {
    // Live QC false positive: correctly Europe-tagged, previously flagged because
    // "europe" wasn't a recognized token so the story had no anchor.
    const r = reconcileRegion('Europe', 'Flash floods strike Europe as heavy rains trigger water rescues across the region')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Europe')
  })

  it('US analysis about the Middle East tagged Middle East → kept, not corrected to US', () => {
    // Both regions are named; the assigned Middle East agrees with a named place,
    // so it must be kept rather than flipped to US just because "united states" matched.
    const r = reconcileRegion('Middle East', 'bin Laden expected the United States to leave the Middle East after the attacks')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Middle East')
  })

  it('does NOT mis-match "South America" as US/domestic (greedy-token regression)', () => {
    const places = extractPlaces('Strong El Niño emerges off the Pacific coast of South America').map(p => p.token)
    expect(places).not.toContain('america')
    // no recognized bucket → no correction, keep assigned rather than mislabel domestic
    const r = reconcileRegion('Europe', 'Strong El Niño emerges off the Pacific coast of South America')
    expect(r.region).not.toBe(null)
  })
})

describe('PLACE_REGION gazetteer — expanded country coverage (existing buckets only)', () => {
  const region = (text: string) => reconcileRegion(null, text).region

  it('routes Albania (the real blindspot case) to Europe via its demonym', () => {
    expect(region('Albanian protests against a Kushner-linked resort reach day 21')).toBe('Europe')
  })

  it('routes newly-added European countries and demonyms to Europe', () => {
    expect(region('Serbia and Kosovo hold emergency talks over the border')).toBe('Europe')
    expect(region('Hungarian government clashes with Brussels over the rule of law')).toBe('Europe')
    expect(region('Romania holds a contested presidential runoff')).toBe('Europe')
  })

  it('routes newly-added Middle East, Africa, and South Asia places', () => {
    expect(region('Kuwait announces new oil production targets')).toBe('Middle East')
    expect(region('Nigerian forces respond to unrest in the north')).toBe('Africa')
    expect(region('Bangladeshi garment workers strike over wages')).toBe('South Asia')
  })

  it('does NOT invent a region for Latin America / East Asia (no taxonomy bucket — deferred)', () => {
    // Cuba is deliberately omitted: there is no Latin America region bucket, so it
    // must stay null rather than be "corrected" to a value the pipeline can't use.
    expect(region('Cuba implements economic reforms including private enterprise expansion')).toBe(null)
  })

  it('does not false-match ambiguous common-word demonyms (deliberately skipped)', () => {
    expect(region('A popular danish pastry recipe goes viral')).toBe(null)
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

// Region mis-tag: a US-domestic story from a FOREIGN outlet keeps the outlet's
// home region (ABC News Australia → "Australia") unless the text names a US place
// in the map. The map was missing ~44 US states, so e.g. a Massachusetts story
// stayed tagged Australia and was locked out of US-domestic Need To Know.
describe('reconcileRegion — US states from foreign outlets', () => {
  it('Massachusetts story tagged Australia (ABC News Australia) → corrected to US (null)', () => {
    const r = reconcileRegion('Australia', 'Massachusetts jury deadlocks in triple-murder case; judge weighs mistrial')
    expect(r.corrected).toBe(true)
    expect(r.region).toBe(null)
  })

  it('recognizes a multi-word state (North Carolina)', () => {
    const r = reconcileRegion('Europe', 'North Carolina flooding displaces thousands along the coast')
    expect(r.corrected).toBe(true)
    expect(r.region).toBe(null)
  })

  it('recognizes a single-word state (Ohio)', () => {
    expect(extractPlaces('Ohio train derailment prompts evacuation').map(x => x.token)).toContain('ohio')
  })

  it('does not match a new state token inside a word (maine ≠ remained)', () => {
    expect(extractPlaces('The agreement remained in force').map(x => x.token)).not.toContain('maine')
  })

  it('leaves an ambiguous token (Georgia the country) alone — not added, so no US mis-correction', () => {
    // Georgia (country) protests should NOT be forced to US; georgia is deliberately omitted.
    expect(extractPlaces('Georgia protests escalate in Tbilisi').map(x => x.token)).not.toContain('georgia')
  })
})
