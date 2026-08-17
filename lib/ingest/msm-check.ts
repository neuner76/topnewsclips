// One entry per DISTINCT outlet. `domains` are alternate domains that count as
// the same outlet (e.g. BBC's .com and .co.uk) — so an outlet is never counted
// twice. The denominator is the number of distinct outlets (MSM_OUTLET_COUNT),
// always constant, which is what stops the "of 14" / "of 15" flip: previously
// BBC's two domains inflated the not-covered side to 15 whenever BBC hadn't
// covered a story, and collapsed to 14 when it had.
const MSM_OUTLETS: { name: string; domains: string[] }[] = [
  { name: 'New York Times', domains: ['nytimes.com'] },
  { name: 'Washington Post', domains: ['washingtonpost.com'] },
  { name: 'CNN', domains: ['cnn.com'] },
  { name: 'BBC', domains: ['bbc.com', 'bbc.co.uk'] },
  { name: 'NBC News', domains: ['nbcnews.com'] },
  { name: 'ABC News', domains: ['abcnews.go.com'] },
  { name: 'CBS News', domains: ['cbsnews.com'] },
  { name: 'Fox News', domains: ['foxnews.com'] },
  { name: 'AP', domains: ['apnews.com'] },
  { name: 'Reuters', domains: ['reuters.com'] },
  { name: 'Politico', domains: ['politico.com'] },
  { name: 'The Hill', domains: ['thehill.com'] },
  { name: 'USA Today', domains: ['usatoday.com'] },
  { name: 'Wall Street Journal', domains: ['wsj.com'] },
  { name: 'NPR', domains: ['npr.org'] },
]

// The single source of truth for the coverage denominator. Importers (e.g.
// lib/coverage-integrity.ts) must reference this rather than hard-coding 15.
export const MSM_OUTLET_COUNT = MSM_OUTLETS.length

// A story published BY one of the tracked outlets is, by construction, covered by
// that outlet — an AP story "covered by 0 of 15 outlets" is nonsense. Map the
// story's own outlet (by exact journalist handle, or an unambiguous source name)
// to that outlet's domain so it counts itself. Exact handles only for the
// ambiguous ones: 'abcnews' is US ABC, but 'abcnewsaustralia' must NOT credit it.
const OUTLET_SELF_HANDLES: Record<string, string> = {
  nytimes: 'nytimes.com', washingtonpost: 'washingtonpost.com', cnn: 'cnn.com',
  bbcnews: 'bbc.com', bbcworldservice: 'bbc.com', nbcnews: 'nbcnews.com',
  abcnews: 'abcnews.go.com', cbsnews: 'cbsnews.com', foxnews: 'foxnews.com',
  associatedpress: 'apnews.com', aparchive: 'apnews.com', reuters: 'reuters.com',
  politico: 'politico.com', thehill: 'thehill.com', usatoday: 'usatoday.com',
  wsj: 'wsj.com', npr: 'npr.org',
}
// Unambiguous full-name source substrings (search-ingested clips lack a handle).
// 'abc news' is deliberately excluded — it also matches "ABC News Australia".
const OUTLET_SELF_SOURCES: Array<[string, string]> = [
  ['new york times', 'nytimes.com'], ['washington post', 'washingtonpost.com'],
  ['associated press', 'apnews.com'], ['ap archive', 'apnews.com'],
  ['wall street journal', 'wsj.com'], ['reuters', 'reuters.com'],
  ['fox news', 'foxnews.com'], ['cbs news', 'cbsnews.com'], ['nbc news', 'nbcnews.com'],
]

export function originatingOutletDomain(journalistUsername?: string | null, source?: string | null): string | null {
  const handle = (journalistUsername ?? '').toLowerCase()
  if (OUTLET_SELF_HANDLES[handle]) return OUTLET_SELF_HANDLES[handle]
  const src = (source ?? '').toLowerCase()
  for (const [sub, domain] of OUTLET_SELF_SOURCES) if (src.includes(sub)) return domain
  return null
}

export interface MSMCheckResult {
  articleCount: number
  msmGap: boolean
  topSources: string[]
  coveredBy: string[]
  notCoveredBy: string[]
  // True when a thin count is unreliable because the environment (usually a CI
  // datacenter IP) is being rate-limited by Google News RSS — callers should not
  // persist the degraded coverage as authoritative.
  throttled?: boolean
}

export interface StoryForRecheck {
  id: string
  title: string
  msm_gap: boolean
}

export async function recheckMSMCoverage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stories: StoryForRecheck[]
): Promise<{ updated: number }> {
  let updated = 0
  for (const story of stories) {
    const result = await checkMSMCoverage(story.title)
    // Skip a throttled result — don't overwrite existing coverage with a degraded
    // (rate-limited) count.
    if (result.articleCount >= 0 && !result.throttled) {
      await supabase.from('stories').update({
        msm_gap: result.msmGap,
        msm_outlet_coverage: { covered: result.coveredBy, notCovered: result.notCoveredBy },
      }).eq('id', story.id)
      updated++
    }
    await new Promise(r => setTimeout(r, 600))
  }
  return { updated }
}

// Below this many covered outlets, the full-title query likely under-matched
// (long/specific titles match few outlets), so we also try the normalized query
// and union the results. Union is safe: coverage is monotonic, so a second query
// can only add outlets, never remove the ones the full title already found.
const COVERAGE_RETRY_THRESHOLD = 5

// Subordinate/appositive connectors that usually begin the "elaboration" tail of
// a headline (e.g. "…Strait of Hormuz amid escalating naval confrontation").
// Only clear elaboration-tail markers — cutting here keeps a core that still
// identifies the SAME story. Deliberately excludes 'and'/'as'/'over'/'that'/
// 'which', which can cut mid-subject and make the query too broad (a too-broad
// query would union in outlets covering the topic generally, a false positive).
const QUERY_CONNECTORS = new Set([
  'amid', 'after', 'following', 'while', 'despite', 'when', 'where',
  'because', 'since', 'though', 'although',
])

// Turn a long story title into a shorter core query that a news search can match
// against how outlets actually headline the same event. Deterministic; the caller
// unions this result with the full-title result so an imperfect trim is neutral.
export function normalizeCoverageQuery(title: string): string {
  let t = (title ?? '').trim()
  if (!t) return ''
  t = t.replace(/^(the|a|an)\s+/i, '')
  // Cut at the first clause punctuation (comma/semicolon/colon/dash).
  const punct = t.search(/[,;:—]|\s-{1,2}\s/)
  if (punct > 0) t = t.slice(0, punct)
  // Cut at the first subordinate connector; cap at a word budget.
  const out: string[] = []
  for (const w of t.split(/\s+/)) {
    if (QUERY_CONNECTORS.has(w.toLowerCase().replace(/[^a-z]/g, ''))) break
    out.push(w)
    if (out.length >= 12) break
  }
  return out.join(' ').trim()
}

async function fetchCoveredOutlets(query: string): Promise<{ covered: Set<string>; items: number; sources: string[] } | null> {
  const encoded = encodeURIComponent(query.slice(0, 100))
  const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`
  const res = await fetch(rssUrl, { headers: { 'User-Agent': 'TopNewsClips/1.0' } })
  if (!res.ok) return null
  const xml = await res.text()
  const items = xml.match(/<item>/g)?.length ?? 0
  const xmlLower = xml.toLowerCase()
  const covered = new Set<string>()
  for (const outlet of MSM_OUTLETS) {
    if (outlet.domains.some(domain => xmlLower.includes(domain))) covered.add(outlet.domains[0])
  }
  const sources = [...xml.matchAll(/<source[^>]*>([^<]+)<\/source>/g)].map(m => m[1]).slice(0, 5)
  return { covered, items, sources }
}

// Full-title + normalized-core union — the #11 logic, extracted so the retry can
// reuse it. Union is safe: coverage is monotonic.
async function unionCoverage(query: string): Promise<{ covered: Set<string>; items: number; sources: string[] } | null> {
  const primary = await fetchCoveredOutlets(query)
  if (!primary) return null
  let covered = primary.covered
  let items = primary.items
  let sources = primary.sources
  const normalized = normalizeCoverageQuery(query)
  if (covered.size < COVERAGE_RETRY_THRESHOLD && normalized && normalized.toLowerCase() !== query.trim().toLowerCase()) {
    await new Promise(r => setTimeout(r, 600))
    const alt = await fetchCoveredOutlets(normalized)
    if (alt) {
      covered = new Set([...covered, ...alt.covered])
      items = Math.max(items, alt.items)
      if (sources.length === 0) sources = alt.sources
    }
  }
  return { covered, items, sources }
}

// Throttle detection. A query that ALWAYS has broad MSM coverage in a healthy
// environment; if even this comes back thin, Google News RSS is rate-limiting us
// (the recurring CI-IP throttle) and any thin story count is unreliable, not real.
// The probe result is cached so a run only pays for it roughly once, not per story.
const THROTTLE_CANARY_QUERY = 'white house'
const THROTTLE_CANARY_MIN_OUTLETS = 4
const THROTTLE_BACKOFF_MS = 2500
const CANARY_TTL_MS = 45_000
let canaryCache: { at: number; throttled: boolean } | null = null

// Test seam: clear the cached canary probe between cases.
export function resetThrottleDetection(): void {
  canaryCache = null
}

async function environmentThrottled(): Promise<boolean> {
  if (canaryCache && Date.now() - canaryCache.at < CANARY_TTL_MS) return canaryCache.throttled
  const canary = await fetchCoveredOutlets(THROTTLE_CANARY_QUERY)
  const throttled = !canary || canary.covered.size < THROTTLE_CANARY_MIN_OUTLETS
  canaryCache = { at: Date.now(), throttled }
  return throttled
}

export async function checkMSMCoverage(
  query: string,
  originating?: { journalistUsername?: string | null; source?: string | null },
): Promise<MSMCheckResult> {
  try {
    let union = await unionCoverage(query)
    if (!union) return { articleCount: -1, msmGap: false, topSources: [], coveredBy: [], notCoveredBy: [] }
    let throttled = false

    // A thin count is either genuinely low or the environment is throttled.
    // Distinguish with the canary; if throttled, back off and retry once. If the
    // retry recovers a higher count the throttle was transient; otherwise flag it
    // so callers don't persist the degraded coverage.
    if (union.covered.size < COVERAGE_RETRY_THRESHOLD && await environmentThrottled()) {
      throttled = true
      await new Promise(r => setTimeout(r, THROTTLE_BACKOFF_MS))
      canaryCache = null // force a fresh probe on the next thin story
      const retry = await unionCoverage(query)
      if (retry && retry.covered.size > union.covered.size) {
        union = retry
        throttled = false
      }
    }

    // Credit the story's own outlet — a story published BY a tracked outlet is
    // covered by that outlet regardless of what the RSS search surfaced.
    const ownDomain = originating ? originatingOutletDomain(originating.journalistUsername, originating.source) : null
    if (ownDomain) union.covered.add(ownDomain)

    // Each outlet lands in exactly one bucket, so coveredBy + notCoveredBy is
    // ALWAYS MSM_OUTLET_COUNT — the denominator can't shrink or flip.
    const coveredBy = MSM_OUTLETS.filter(o => union.covered.has(o.domains[0])).map(o => o.domains[0])
    const notCoveredBy = MSM_OUTLETS.filter(o => !union.covered.has(o.domains[0])).map(o => o.domains[0])

    return {
      articleCount: union.items,
      msmGap: union.items < 5 || coveredBy.length < 3,
      topSources: union.sources,
      coveredBy,
      notCoveredBy,
      throttled,
    }
  } catch {
    return { articleCount: -1, msmGap: false, topSources: [], coveredBy: [], notCoveredBy: [] }
  }
}
