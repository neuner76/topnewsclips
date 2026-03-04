export interface YouTubeClip {
  title: string
  videoId: string
  videoUrl: string
  platform: 'youtube'
  viewCount: number
  channelTitle: string
  description: string
  publishedAt: string
  journalistUsername: string | null
}

// Incident-specific queries that naturally skew toward US domestic footage
// Capped at 8 to stay within YouTube API default quota (10k units/day)
const SEARCH_QUERIES = [
  'bodycam footage released 2026',
  'road rage dashcam viral 2026',
  'caught on camera local news America 2026',
  'police shooting bodycam released 2026',
  'arrest video released police department 2026',
  'security camera footage incident viral 2026',
  'breakthrough clean energy technology 2026',
  'food water innovation breakthrough 2026',
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

export async function fetchYouTubeTrending(
  apiKey: string,
  channelHandles: string[] = []
): Promise<{ clips: YouTubeClip[]; errors: string[] }> {
  const clips: YouTubeClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  // Last 7 days — wide enough to find content, Claude filters for relevance
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const query of SEARCH_QUERIES) {
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

        // Skip Indic/Arabic scripts: Telugu, Hindi, Bengali, Tamil, Kannada, Malayalam, Arabic, etc.
        if (/[\u0600-\u0DFF]/.test(snippet.title)) continue

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
          journalistUsername: null,
        })
      }
    } catch (err) {
      errors.push(`YouTube error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Fetch recent videos from featured journalist channels
  if (channelHandles.length > 0) {
    await fetchJournalistChannels(apiKey, channelHandles, clips, errors, seen)
  }

  return { clips, errors }
}

async function fetchJournalistChannels(
  apiKey: string,
  handles: string[],
  clips: YouTubeClip[],
  errors: string[],
  seen: Set<string>
) {
  // 14-day window so we don't miss less-frequent posters
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  for (const handle of handles) {
    try {
      // Resolve @handle → internal channel ID
      const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
      channelUrl.searchParams.set('part', 'id,snippet')
      channelUrl.searchParams.set('forHandle', `@${handle}`)
      channelUrl.searchParams.set('key', apiKey)

      const channelRes = await fetch(channelUrl.toString())
      if (!channelRes.ok) {
        errors.push(`YouTube journalist @${handle}: channel lookup HTTP ${channelRes.status}`)
        continue
      }

      const channelJson = await channelRes.json()
      const channelItem = channelJson?.items?.[0]
      if (!channelItem) {
        errors.push(`YouTube journalist @${handle}: channel not found`)
        continue
      }

      const channelId: string = channelItem.id
      const channelTitle: string = channelItem.snippet?.title ?? handle

      // Fetch 5 most recent videos from this channel
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('channelId', channelId)
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('order', 'date')
      searchUrl.searchParams.set('publishedAfter', cutoff)
      searchUrl.searchParams.set('maxResults', '5')
      searchUrl.searchParams.set('key', apiKey)

      const searchRes = await fetch(searchUrl.toString())
      if (!searchRes.ok) {
        errors.push(`YouTube journalist @${handle}: search HTTP ${searchRes.status}`)
        continue
      }

      const searchJson = await searchRes.json()
      const searchItems: Array<{ id: { videoId: string }; snippet: { title: string; description: string; publishedAt: string } }> =
        searchJson?.items ?? []

      if (searchItems.length === 0) continue

      // Batch fetch stats
      const videoIds = searchItems.map(i => i.id.videoId).join(',')
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
        if (seen.has(videoId)) continue

        const snippet = item.snippet
        const stats = statsMap.get(videoId) as { viewCount?: string } | undefined
        const viewCount = parseInt(stats?.viewCount ?? '0', 10)

        seen.add(videoId)
        clips.push({
          title: snippet.title,
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          platform: 'youtube',
          viewCount,
          channelTitle,
          description: (snippet.description ?? '').slice(0, 500),
          publishedAt: snippet.publishedAt,
          journalistUsername: handle.toLowerCase(),
        })
      }
    } catch (err) {
      errors.push(`YouTube journalist @${handle}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
