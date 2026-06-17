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

export interface MSMCheckResult {
  articleCount: number
  msmGap: boolean
  topSources: string[]
  coveredBy: string[]
  notCoveredBy: string[]
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
    if (result.articleCount >= 0) {
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

export async function checkMSMCoverage(query: string): Promise<MSMCheckResult> {
  try {
    const encoded = encodeURIComponent(query.slice(0, 100))
    const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`

    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'TopNewsClips/1.0' },
    })
    if (!res.ok) return { articleCount: -1, msmGap: false, topSources: [], coveredBy: [], notCoveredBy: [] }

    const xml = await res.text()

    // Count items published in last 48 hours
    const items = xml.match(/<item>/g)?.length ?? 0

    // Extract source domains
    const sourceMatches = [...xml.matchAll(/<source[^>]*>([^<]+)<\/source>/g)]
    const sources = sourceMatches.map(m => m[1]).slice(0, 5)

    // Check which distinct MSM outlets are covering it. Each outlet lands in
    // exactly one bucket, so coveredBy.length + notCoveredBy.length is ALWAYS
    // MSM_OUTLET_COUNT — the denominator can no longer shrink or flip. We return
    // each outlet's primary domain to keep the existing string[] shape.
    const xmlLower = xml.toLowerCase()
    const coveredBy: string[] = []
    const notCoveredBy: string[] = []
    for (const outlet of MSM_OUTLETS) {
      const covered = outlet.domains.some(domain => xmlLower.includes(domain))
      ;(covered ? coveredBy : notCoveredBy).push(outlet.domains[0])
    }

    return {
      articleCount: items,
      msmGap: items < 5 || coveredBy.length < 3,
      topSources: sources,
      coveredBy,
      notCoveredBy,
    }
  } catch {
    return { articleCount: -1, msmGap: false, topSources: [], coveredBy: [], notCoveredBy: [] }
  }
}
