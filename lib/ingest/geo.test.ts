import { describe, expect, it } from 'vitest'
import { extractPlaces, reconcileRegion, resolveStoryRegion, stripSourceName, sourceNameVariants, PLACE_REGION } from './geo'

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

// A US-subject story from a FOREIGN broadcaster was keeping the outlet's home
// region because the outlet's own name, echoed in the summary's attribution
// ("according to France 24's reporting"), matched as a named place and made the
// channel-home tag look self-consistent. The real IPO clip — France 24 on
// Anthropic's $81B US IPO — stayed "Europe" and was locked out of US Need To Know.
describe('reconcileRegion — strips the outlet name from the attribution', () => {
  it('France 24 clip on a US-company IPO → corrected to US (null), not kept Europe', () => {
    const text = 'Anthropic Goes Public at $1.5 Trillion Valuation in $81 Billion IPO. ' +
      "According to France 24's reporting, the U.S. AI lab completed its listing."
    const kept = reconcileRegion('Europe', text)                       // no source name → old behavior
    expect(kept.region).toBe('Europe')                                 // "france" (from France 24) wins
    const fixed = reconcileRegion('Europe', text, 'YouTube/France 24 English')
    expect(fixed.corrected).toBe(true)
    expect(fixed.region).toBe(null)                                    // only "u.s." remains → domestic
  })

  it('does NOT strip a bare subject mention of the outlet-home country', () => {
    // "France's economy" is the subject, not an attribution — it must survive so
    // the story stays Europe even though the outlet is France 24.
    const text = "France's economy shrinks as U.S. markets react, France 24 reports."
    const r = reconcileRegion('Europe', text, 'YouTube/France 24 English')
    expect(r.region).toBe('Europe')                                    // France (subject) agrees → kept
  })

  it('keeps a genuinely foreign story when only the outlet name carried the place', () => {
    // No other place named; stripping the outlet name leaves nothing to verify,
    // so the assigned region is kept (cannot verify), not flipped.
    const r = reconcileRegion('Middle East', 'Al Jazeera examines shifting alliances across the region', 'YouTube/Al Jazeera English')
    expect(r.corrected).toBe(false)
    expect(r.region).toBe('Middle East')
  })

  it('sourceNameVariants yields the full name and qualifier-trimmed forms, never a bare word', () => {
    expect(sourceNameVariants('YouTube/France 24 English')).toEqual(['france 24 english', 'france 24'])
    expect(sourceNameVariants('Reuters')).toEqual([])                  // single bare word → not stripped
  })

  it('stripSourceName blanks the name but preserves surrounding text length/boundaries', () => {
    const out = stripSourceName("per France 24's report", 'France 24 English')
    expect(out).not.toMatch(/france/i)
    expect(out).toContain("'s report")
  })
})

// The region is assigned from the RAW candidate (title + YouTube description),
// before the LLM summary exists — but the subject geography and the outlet-name
// attribution both live in that summary. reconcileRegion on the raw text alone
// therefore misses them: the real France 24 Anthropic IPO row had a placeless
// headline, so the channel-home "Europe" tag survived, and the clean "U.S.-based"
// signal only appeared in the summary the function never saw. resolveStoryRegion
// adds a second pass over the generated summary so the correction actually fires.
describe('resolveStoryRegion — reconciles against the generated summary too', () => {
  const rawTitle = 'AI Lab Anthropic Goes Public at $1.5 Trillion Valuation in $81 Billion IPO'
  const summary = 'Anthropic, a U.S.-based artificial intelligence laboratory, completed its ' +
    'initial public offering. France 24 frames the offering as a bellwether for tech investment.'

  it('corrects a placeless-headline US story once the summary reveals the subject (France 24 IPO)', () => {
    // Raw-only reconcile keeps Europe — the headline names no place at all.
    const rawOnly = resolveStoryRegion({ rawRegion: 'Europe', rawText: rawTitle, sourceName: 'YouTube/France 24 English' })
    expect(rawOnly.region).toBe('Europe')
    // With the summary, the outlet name is stripped and "u.s." wins → domestic.
    const resolved = resolveStoryRegion({
      rawRegion: 'Europe',
      rawText: rawTitle,
      summaryText: summary,
      sourceName: 'YouTube/France 24 English',
    })
    expect(resolved.corrected).toBe(true)
    expect(resolved.region).toBe(null)
  })

  it('keeps a correction the RAW pass already made when the summary agrees', () => {
    // WION (home South Asia) covering Lebanon: raw text names Lebanon → Middle East.
    const resolved = resolveStoryRegion({
      rawRegion: 'South Asia',
      rawText: 'Lebanese families rebuild homes in southern Lebanon after the conflict',
      summaryText: 'Reconstruction continues across Lebanon months after the fighting ended.',
      sourceName: 'YouTube/WION',
    })
    expect(resolved.corrected).toBe(true)
    expect(resolved.region).toBe('Middle East')
  })

  it('falls back to the raw-only result when there is no summary', () => {
    const withEmpty = resolveStoryRegion({ rawRegion: 'Europe', rawText: rawTitle, summaryText: '   ', sourceName: 'YouTube/France 24 English' })
    const noSummary = resolveStoryRegion({ rawRegion: 'Europe', rawText: rawTitle, sourceName: 'YouTube/France 24 English' })
    expect(withEmpty.region).toBe('Europe')
    expect(noSummary.region).toBe('Europe')
  })

  it('does not flip a genuinely foreign story when only the outlet name is in the summary', () => {
    const resolved = resolveStoryRegion({
      rawRegion: 'Middle East',
      rawText: 'Al Jazeera examines shifting regional alliances',
      summaryText: 'Al Jazeera analyzes how alliances are shifting across the region.',
      sourceName: 'YouTube/Al Jazeera English',
    })
    expect(resolved.corrected).toBe(false)
    expect(resolved.region).toBe('Middle East')
  })

  it('keeps a domestic (null) story domestic when the summary names US places', () => {
    const resolved = resolveStoryRegion({
      rawRegion: null,
      rawText: 'Clinic standoff ends in Texas',
      summaryText: 'The standoff in Texas ended as Washington weighed a federal response.',
      sourceName: 'YouTube/NBC News',
    })
    expect(resolved.corrected).toBe(false)
    expect(resolved.region).toBe(null)
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
