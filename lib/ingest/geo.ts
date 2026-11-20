// Single source of truth: country / territory / major place → taxonomy region.
//
// Region tags are assigned from the SOURCE CHANNEL's home region (see
// lib/ingest/global.ts GLOBAL_YOUTUBE_CHANNELS), so cross-region coverage gets
// mislabeled — a WION (home: South Asia) clip about Lebanon is tagged "South
// Asia", an Al Jazeera (home: Middle East) clip about Congo is tagged "Middle
// East". This map reconciles the channel-derived region against the places
// actually NAMED in the story text, correcting the tag when they disagree.
//
// Regions match the buckets the system already tags + groups by (global.ts +
// the digest's regional sections). US places map to `null` — the codebase's
// domestic signal (a US story carries a null region). Countries without a clean
// existing bucket (China, SE Asia, Latin America) are deliberately omitted so we
// never "correct" a region to a value the rest of the pipeline doesn't use.

export type Region =
  | 'Middle East'
  | 'Europe'
  | 'Africa'
  | 'South Asia'
  | 'Japan'
  | 'Korea'
  | 'Australia'

// place token (lowercase) → region, or null for United States (domestic).
// The map itself lives in place-region.mjs so the plain-node live verifier can
// share it (single source of truth, spec A3). Tokens are matched case-
// insensitively on word boundaries against headline + summary.
import { PLACE_REGION as RAW_PLACE_REGION } from './place-region.mjs'

export const PLACE_REGION: Record<string, Region | null> = RAW_PLACE_REGION as Record<string, Region | null>

export interface PlaceMatch {
  token: string
  region: Region | null
}

// Extract the named places we recognize from headline + summary. Longer tokens
// match first (so "south korea" wins over "korea"), and a matched token isn't
// re-matched as a substring of itself.
export function extractPlaces(text: string): PlaceMatch[] {
  let haystack = ` ${text.toLowerCase()} `
  const tokens = Object.keys(PLACE_REGION).sort((a, b) => b.length - a.length)
  const matches: PlaceMatch[] = []
  for (const token of tokens) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'gi')
    let matched = false
    // Replace each occurrence with blanks of equal length so a shorter token
    // (e.g. "korea") can't re-match the span of a longer one ("south korea").
    haystack = haystack.replace(re, (_full, before, after) => {
      matched = true
      return `${before}${' '.repeat(token.length)}${after}`
    })
    if (matched) matches.push({ token, region: PLACE_REGION[token] })
  }
  return matches
}

// Generic trailing words outlets append that aren't part of the distinguishing
// name, so "France 24 English" also yields the "France 24" variant to strip.
const OUTLET_QUALIFIER_WORDS = new Set([
  'english', 'news', 'network', 'television', 'tv', 'channel', 'media',
  'arabic', 'world', 'international', 'online', 'digital', 'service', 'live',
])

// Variants of an outlet name to blank from the text before place-matching, e.g.
// "YouTube/France 24 English" → ["france 24 english", "france 24"]. Only the full
// name phrase and its qualifier-trimmed forms — never a bare single word like
// "france", so a genuine subject mention ("France's economy") still counts.
export function sourceNameVariants(sourceName: string): string[] {
  const base = sourceName
    .replace(/^youtube\//i, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!base) return []
  const variants = new Set<string>([base])
  let words = base.split(' ')
  while (words.length > 1 && OUTLET_QUALIFIER_WORDS.has(words[words.length - 1])) {
    words = words.slice(0, -1)
    variants.add(words.join(' '))
  }
  // Keep only multi-word or distinctive variants: a single bare word (e.g.
  // "reuters", "france") is too likely to also be a real subject mention.
  return [...variants]
    .filter(v => v.includes(' ') && v.length >= 4)
    .sort((a, b) => b.length - a.length)
}

// Remove an outlet's own name from the text so an attribution ("according to
// France 24's reporting") can't inject a false place signal that makes the
// channel-home region look self-consistent. Blanks with equal-length spaces to
// preserve word boundaries for the subsequent place match.
export function stripSourceName(text: string, sourceName?: string | null): string {
  if (!sourceName) return text
  let out = text
  for (const v of sourceNameVariants(sourceName)) {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(
      new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'gi'),
      (_full, before, after) => `${before}${' '.repeat(v.length)}${after}`,
    )
  }
  return out
}

export interface RegionReconciliation {
  region: string | null // a Region when corrected; the passthrough assigned value (incl. 'World') otherwise
  corrected: boolean
  matches: PlaceMatch[]
  reason?: string
}

// Reconcile a channel-derived region against the places named in the text.
//   - no recognized places           → keep assigned (can't verify)
//   - assigned region is among them   → keep assigned (consistent)
//   - assigned contradicts all places → correct to the dominant named region
// "Dominant" = most-named region, tie-broken by first appearance in the text.
export function reconcileRegion(
  assignedRegion: string | null,
  text: string,
  sourceName?: string | null,
): RegionReconciliation {
  const matches = extractPlaces(stripSourceName(text, sourceName))
  if (matches.length === 0) {
    return { region: (assignedRegion as Region | null) ?? null, corrected: false, matches }
  }

  // Does the assigned region agree with any named place? (null = domestic/US)
  const assigned = assignedRegion ?? null
  const agrees = matches.some(m => m.region === assigned)
  if (agrees) {
    return { region: assigned as Region | null, corrected: false, matches }
  }

  // Correct to the dominant named region (count, then first appearance).
  const lower = text.toLowerCase()
  const counts = new Map<Region | null, { n: number; firstIdx: number }>()
  for (const m of matches) {
    const idx = lower.indexOf(m.token)
    const cur = counts.get(m.region)
    if (!cur) counts.set(m.region, { n: 1, firstIdx: idx })
    else { cur.n += 1; cur.firstIdx = Math.min(cur.firstIdx, idx) }
  }
  let best: Region | null = matches[0].region
  let bestStat = counts.get(best)!
  for (const [region, stat] of counts) {
    if (stat.n > bestStat.n || (stat.n === bestStat.n && stat.firstIdx < bestStat.firstIdx)) {
      best = region
      bestStat = stat
    }
  }
  return {
    region: best,
    corrected: best !== assigned,
    matches,
    reason: `assigned region "${assigned ?? 'US/domestic'}" contradicts named places (${matches.map(m => m.token).join(', ')}); corrected to "${best ?? 'US/domestic'}"`,
  }
}
