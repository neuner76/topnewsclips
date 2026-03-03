export interface YouTubeClip {
  title: string
  videoId: string
  videoUrl: string
  platform: 'youtube'
  viewCount: number
  channelTitle: string
  description: string
  publishedAt: string
}

// Incident-specific queries that naturally skew toward US domestic footage
const SEARCH_QUERIES = [
  'bodycam footage released 2026',
  'police chase caught on camera America 2026',
  'town hall confrontation viral video 2026',
  'school board meeting viral 2026',
  'weather tornado flood footage local news 2026',
  'caught on camera local news America 2026',
  'dashcam accident viral news America',
  'city council protest viral footage 2026',
]

// Known MSM channel IDs to filter out
const MSM_CHANNEL_IDS = new Set([
  'UCVTyTA4-tXLqqHMIwRDgv4Q', // ABC News
  'UCupvZG-5ko_eiXAupbDfxWw', // CNN
  'UCeY0bbntWzzVIaj2z3QigXg', // NBC News
  'UCWX3yGbODI3HLWdB3DXqvqA', // CBS News
  'UCXIJgqnII2ZOINSWNBtFz_w', // Fox News
  'UC16niRr50-MSBwiO3YDb3RA', // BBC News
  'UCNkT3sqMFHXEFMHX7sSwMVQ', // PBS NewsHour
  'UCknLrEdhRCp1aegoMqRaCZg', // ABC News Australia
])

export async function fetchYouTubeTrending(apiKey: string): Promise<{ clips: YouTubeClip[]; errors: string[] }> {
  const clips: YouTubeClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  // Last 7 days — wide enough to find content, Claude filters for relevance
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const query of SEARCH_QUERIES.slice(0, 4)) {
    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('q', query)
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('order', 'viewCount')
      searchUrl.searchParams.set('publishedAfter', cutoff)
      searchUrl.searchParams.set('relevanceLanguage', 'en')
      searchUrl.searchParams.set('regionCode', 'US')
      searchUrl.searchParams.set('maxResults', '10')
      searchUrl.searchParams.set('key', apiKey)

      const searchRes = await fetch(searchUrl.toString())
      if (!searchRes.ok) {
        const body = await searchRes.text()
        errors.push(`YouTube "${query.slice(0, 20)}": HTTP ${searchRes.status} - ${body.slice(0, 100)}`)
        continue
      }

      const searchJson = await searchRes.json()
      const searchItems = searchJson?.items ?? []

      if (searchItems.length === 0) {
        errors.push(`YouTube "${query.slice(0, 20)}": 0 results`)
        continue
      }

      // Get video stats in a single batch call
      const videoIds = searchItems.map((i: { id: { videoId: string } }) => i.id.videoId).join(',')
      const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
      statsUrl.searchParams.set('part', 'statistics')
      statsUrl.searchParams.set('id', videoIds)
      statsUrl.searchParams.set('key', apiKey)

      const statsRes = await fetch(statsUrl.toString())
      const statsJson = statsRes.ok ? await statsRes.json() : { items: [] }
      const statsMap = new Map(
        (statsJson.items ?? []).map((i: { id: string; statistics: { viewCount?: string } }) => [i.id, i.statistics])
      )

      for (const item of searchItems) {
        const videoId = item.id.videoId
        const snippet = item.snippet
        const channelId = snippet.channelId

        if (seen.has(videoId)) continue
        if (MSM_CHANNEL_IDS.has(channelId)) continue

        // Skip non-English titles (Telugu, Hindi, Arabic, etc. contain non-ASCII characters)
        // eslint-disable-next-line no-control-regex
        const nonAsciiRatio = (snippet.title.match(/[^\x00-\x7F]/g) ?? []).length / snippet.title.length
        if (nonAsciiRatio > 0.1) continue

        const stats = statsMap.get(videoId) as { viewCount?: string } | undefined
        const viewCount = parseInt(stats?.viewCount ?? '0', 10)
        if (viewCount < 50000) continue

        seen.add(videoId)
        clips.push({
          title: snippet.title,
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          platform: 'youtube',
          viewCount,
          channelTitle: snippet.channelTitle,
          description: (snippet.description ?? '').slice(0, 500),
          publishedAt: snippet.publishedAt,
        })
      }
    } catch (err) {
      errors.push(`YouTube error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { clips, errors }
}
