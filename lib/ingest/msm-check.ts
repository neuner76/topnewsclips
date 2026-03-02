const MSM_OUTLETS = [
  'nytimes.com', 'washingtonpost.com', 'cnn.com', 'bbc.com', 'bbc.co.uk',
  'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'foxnews.com', 'apnews.com',
  'reuters.com', 'politico.com', 'thehill.com', 'usatoday.com', 'wsj.com',
]

export interface MSMCheckResult {
  articleCount: number
  msmGap: boolean
  topSources: string[]
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

    // Check if MSM outlets are covering it
    const msmCoverage = MSM_OUTLETS.filter(outlet =>
      xml.toLowerCase().includes(outlet)
    ).length

    return {
      articleCount: items,
      msmGap: items < 5 || msmCoverage < 2,
      topSources: sources,
    }
  } catch {
    return { articleCount: -1, msmGap: false, topSources: [] }
  }
}
