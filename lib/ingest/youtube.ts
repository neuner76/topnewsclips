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
  'caught on camera local news America 2026',
  'security camera footage incident viral 2026',
  'breakthrough clean energy technology 2026',
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

/**
 * Resolve a YouTube channel handle/username to an internal channel ID.
 * Tries @handle format first, then legacy forUsername.
 * Costs 1 API unit — call once and cache the result in the DB.
 */
export async function resolveYouTubeChannelId(handle: string, apiKey: string): Promise<string | null> {
  for (const [param, value] of [
    ['forHandle', `@${handle}`],
    ['forUsername', handle],
  ] as [string, string][]) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/channels')
      url.searchParams.set('part', 'id')
      url.searchParams.set(param, value)
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) continue
      const json = await res.json()
      if (json?.items?.[0]?.id) return json.items[0].id as string
    } catch {
      // try next param
    }
  }
  return null
}

export async function fetchYouTubeTrending(
  apiKey: string,
  journalists: { username: string; channelId: string }[] = []
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

        // Skip Indic/Arabic scripts
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

  // Fetch journalist channels via RSS — no API quota used
  if (journalists.length > 0) {
    await fetchJournalistChannelsViaRSS(journalists, clips, errors, seen)
  }

  return { clips, errors }
}

// RSS feed returns the last 15 videos from a channel — no API key needed, no quota cost
async function fetchJournalistChannelsViaRSS(
  journalists: { username: string; channelId: string }[],
  clips: YouTubeClip[],
  errors: string[],
  seen: Set<string>
) {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  for (const { username, channelId } of journalists) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      const res = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) })

      if (!res.ok) {
        errors.push(`YouTube journalist @${username}: RSS HTTP ${res.status}`)
        continue
      }

      const xml = await res.text()
      const newClips = parseRSSEntries(xml, username, cutoff, seen)
      clips.push(...newClips)
    } catch (err) {
      errors.push(`YouTube journalist @${username}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

function parseRSSEntries(
  xml: string,
  journalistUsername: string,
  cutoff: string,
  seen: Set<string>
): YouTubeClip[] {
  const clips: YouTubeClip[] = []
  const channelTitle =
    xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] ?? journalistUsername

  const entries = xml.split('<entry>').slice(1)

  for (const entry of entries) {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    if (!videoId || seen.has(videoId)) continue

    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? ''
    if (published && published < cutoff) continue

    const rawTitle =
      entry.match(/<media:title>([^<]*)<\/media:title>/)?.[1] ??
      entry.match(/<title>([^<]*)<\/title>/)?.[1] ??
      ''
    const rawDesc = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? ''
    const viewsStr = entry.match(/<media:statistics views="(\d+)"/)?.[1] ?? '0'

    seen.add(videoId)
    clips.push({
      title: decodeXML(stripCDATA(rawTitle)).slice(0, 200),
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      platform: 'youtube',
      viewCount: parseInt(viewsStr, 10),
      channelTitle: decodeXML(channelTitle),
      description: decodeXML(stripCDATA(rawDesc)).slice(0, 500),
      publishedAt: published,
      journalistUsername,
    })
  }

  return clips
}

function stripCDATA(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function decodeXML(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
