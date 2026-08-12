// Single source of truth for satire/comedy sources. Previously duplicated across
// five lists — pipeline.ts (SATIRE_CAP_EXEMPT/_SOURCES, SATIRE_BYPASS_HANDLES/
// _SOURCES) and digest.ts (SATIRE_DIGEST_EXEMPT, SATIRE_HANDLES). The drift
// between them caused a new comedy channel to be registered in some lists but not
// others (Seth Meyers/Babylon Bee reached the pipeline lists but not the digest
// ones, so their clips were ingested but never routed to Comedy & Satire).

export const SATIRE_HANDLES = new Set<string>([
  'thedailyshow', 'lastweektonight', 'joshjohnsoncomedy', 'smn', 'thejuicemedia',
  'jonathanpie', 'saturdaynightlive', 'latenightseth', 'thebabylonbee',
])

// Source-name substrings — matches when a clip arrives via YouTube search with a
// source name but no journalist handle (e.g. "YouTube/Saturday Night Live").
export const SATIRE_SOURCE_SUBSTRINGS = [
  'the daily show', 'last week tonight', 'jonathan pie', 'some more news',
  'josh johnson', 'the juice media', 'saturday night live', 'seth meyers', 'babylon bee',
]

// True if a candidate is from a known satire/comedy source, by journalist handle
// or by source name.
export function isSatireSource(journalistUsername?: string | null, source?: string | null): boolean {
  const handle = (journalistUsername ?? '').toLowerCase()
  if (SATIRE_HANDLES.has(handle)) return true
  const src = (source ?? '').toLowerCase()
  return SATIRE_SOURCE_SUBSTRINGS.some(s => src.includes(s))
}
