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

// Search terms targeting content MSM typically ignores
const SEARCH_QUERIES = [
  'whistleblower leaked footage 2026',
  'citizen journalism viral 2026',
  'government corruption exposed 2026',
  'police brutality caught on camera 2026',
  'corporate cover up exposed 2026',
  'protest footage mainstream media ignoring',
  'leaked documents government 2026',
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

export async function fetchYouTubeTrending(apiKey: string): Promise<YouTubeClip[]> {
  const clips: YouTubeClip[] = []
  const seen = new Set<string>()

  // Get published cutoff: last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  for (const query of SEARCH_QUERIES.slice(0, 3)) {
    try {
      // Search for recent videos on this topic
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('q', query)
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('order', 'viewCount')
      searchUrl.searchParams.set('publishedAfter', cutoff)
      searchUrl.searchParams.set('relevanceLanguage', 'en')
      searchUrl.searchParams.set('maxResults', '10')
      searchUrl.searchParams.set('key', apiKey)

      const searchRes = await fetch(searchUrl.toString())
      if (!searchRes.ok) continue

      const searchJson = await searchRes.json()
      const searchItems = searchJson?.items ?? []

      if (searchItems.length === 0) continue

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

        const stats = statsMap.get(videoId) as { viewCount?: string } | undefined
        const viewCount = parseInt(stats?.viewCount ?? '0', 10)
        if (viewCount < 5000) continue

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
    } catch {
      // skip failed query
    }
  }

  return clips
}
