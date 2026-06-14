// Outlet → home-region reference for region-label integrity (Task 7b).
//
// Per the prior product decision, a story's `region` field is the OUTLET'S
// HOME region, not the geography of the story's subject. So the integrity
// check is: does the stored region agree with the outlet's known home? An
// ECB story carried by Arirang News (a Korean broadcaster) should be region
// "Korea" — and if it were stored as "Europe", that is the mismatch we flag.
//
// This mirrors the GLOBAL_JOURNALIST_REGION / GLOBAL_SOURCE_REGION maps used
// at ingest (lib/ingest/pipeline.ts) but is kept standalone so the digest
// layer doesn't depend on the ingest pipeline's heavier imports.

import type { Story } from './types'

// Keyed by normalized journalist handle (lowercase, no @).
const OUTLET_HOME_BY_HANDLE: Record<string, string> = {
  bbcworldservice: 'Europe',
  channel4news: 'Europe',
  cbcnews: 'Canada',
  abcnewsaustralia: 'Australia',
  france24english: 'Europe',
  france24: 'Europe',
  dwnews: 'Europe',
  dwenglish: 'Europe',
  dwplaneta: 'Europe',
  dwdocumentary: 'Europe',
  aljazeeraenglish: 'Middle East',
  aljazeera: 'Middle East',
  nhkworldjapan: 'Japan',
  nhkworld: 'Japan',
  arirangnews: 'Korea',
  trtworld: 'Middle East',
  wion: 'South Asia',
  africanews: 'Africa',
  reuters: 'World',
  afpnewsagency: 'World',
  cgtn: 'China',
  telesurenglish: 'Latin America',
}

// Matched as a substring against the lowercased `source` string.
const OUTLET_HOME_BY_SOURCE: Array<[string, string]> = [
  ['france 24', 'Europe'],
  ['france24', 'Europe'],
  ['dw news', 'Europe'],
  ['al jazeera', 'Middle East'],
  ['trt world', 'Middle East'],
  ['wion', 'South Asia'],
  ['abc news australia', 'Australia'],
  ['bbc world service', 'Europe'],
  ['channel 4 news', 'Europe'],
  ['cbc news', 'Canada'],
  ['nhk world', 'Japan'],
  ['arirang news', 'Korea'],
  ['africanews', 'Africa'],
  ['cgtn', 'China'],
  ['telesur', 'Latin America'],
]

// Returns the outlet's known home region, or null when the outlet isn't a
// recognized international broadcaster (most US/domestic sources). A null
// result means "no expectation to check against" — never a mismatch.
export function expectedRegionForStory(
  story: Pick<Story, 'journalist_username' | 'source'>
): string | null {
  const handle = (story.journalist_username ?? '').toLowerCase().replace(/^@/, '')
  if (handle && OUTLET_HOME_BY_HANDLE[handle]) return OUTLET_HOME_BY_HANDLE[handle]

  const sourceLower = (story.source ?? '').toLowerCase()
  const match = OUTLET_HOME_BY_SOURCE.find(([needle]) => sourceLower.includes(needle))
  return match ? match[1] : null
}

// "World" is a wildcard home (wire services) — it agrees with any region.
function regionsAgree(stored: string, expected: string): boolean {
  const a = stored.trim().toLowerCase()
  const b = expected.trim().toLowerCase()
  return a === b || a === 'world' || b === 'world'
}

// True when the story's stored region disagrees with the outlet's known home.
// Only fires for recognized international outlets with a non-empty region.
export function hasRegionLabelMismatch(
  story: Pick<Story, 'journalist_username' | 'source' | 'region'>
): boolean {
  const stored = (story.region ?? '').trim()
  if (!stored) return false
  const expected = expectedRegionForStory(story)
  if (!expected) return false
  return !regionsAgree(stored, expected)
}
