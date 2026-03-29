const MSM_OUTLETS = [
  'nytimes.com', 'washingtonpost.com', 'cnn.com', 'bbc.com', 'bbc.co.uk',
  'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'foxnews.com', 'apnews.com',
  'reuters.com', 'politico.com', 'thehill.com', 'usatoday.com', 'wsj.com',
]

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
    if (result.articleCount >= 0 && result.msmGap !== story.msm_gap) {
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
    if (!res.ok) return { articleCount: -1, msmGap: false, topSources: [] }

    const xml = await res.text()

    // Count items published in last 48 hours
    const items = xml.match(/<item>/g)?.length ?? 0

    // Extract source domains
    const sourceMatches = [...xml.matchAll(/<source[^>]*>([^<]+)<\/source>/g)]
    const sources = sourceMatches.map(m => m[1]).slice(0, 5)

    // Check which MSM outlets are covering it
    const xmlLower = xml.toLowerCase()
    const coveredBy = MSM_OUTLETS.filter(outlet => xmlLower.includes(outlet))
    const notCoveredBy = MSM_OUTLETS.filter(outlet => !xmlLower.includes(outlet))

    // Dedupe BBC — bbc.com and bbc.co.uk count as one outlet
    const coveredDeduped = [...new Set(coveredBy.map(o => o === 'bbc.co.uk' ? 'bbc.com' : o))]
    const notCoveredDeduped = notCoveredBy.filter(o => !(o === 'bbc.co.uk' && coveredBy.includes('bbc.com')))

    return {
      articleCount: items,
      msmGap: items < 5 || coveredDeduped.length < 3,
      topSources: sources,
      coveredBy: coveredDeduped,
      notCoveredBy: notCoveredDeduped,
    }
  } catch {
    return { articleCount: -1, msmGap: false, topSources: [], coveredBy: [], notCoveredBy: [] }
  }
}
