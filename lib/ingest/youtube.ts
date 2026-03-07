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

// Search queries targeting each digest category.
// Each costs 100 API units. With a 10k/day quota this leaves room for ~14 pipeline runs/day.
const NEWS_SEARCH_QUERIES = [
  // Politics — specific hearings/investigations, not press briefings
  { q: 'senate hearing testimony investigation 2026', label: 'politics' },
  { q: 'congressional hearing whistleblower accountability', label: 'politics' },
  // Science — peer-reviewed findings, not product demos
  { q: 'scientific study published research university findings', label: 'science' },
  // Incident footage — specific, not generic "breaking news"
  { q: 'bodycam footage police incident 2026', label: 'incident' },
  { q: 'caught on camera security footage news', label: 'incident' },
  // Local news with video — more likely to surface underreported stories
  { q: 'local news investigation caught on video', label: 'local' },
]

const SEARCH_WINDOW_HOURS = 48

export async function fetchYouTubeTrending(
  apiKey: string,
  journalists: { username: string; channelId: string }[] = []
): Promise<{ clips: YouTubeClip[]; errors: string[] }> {
  const clips: YouTubeClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  // Run journalist RSS and search queries in parallel
  await Promise.all([
    journalists.length > 0
      ? fetchJournalistChannelsViaRSS(journalists, clips, errors, seen)
      : Promise.resolve(),
    searchYouTubeNews(apiKey, clips, errors, seen),
  ])

  return { clips, errors }
}

async function searchYouTubeNews(
  apiKey: string,
  clips: YouTubeClip[],
  errors: string[],
  seen: Set<string>
) {
  const publishedAfter = new Date(
    Date.now() - SEARCH_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  // Step 1: run all search queries, collect video IDs + snippets
  const snippetMap = new Map<string, {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
  }>()

  await Promise.all(
    NEWS_SEARCH_QUERIES.map(async ({ q, label }) => {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search')
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('q', q)
        url.searchParams.set('type', 'video')
        url.searchParams.set('order', 'viewCount')
        url.searchParams.set('publishedAfter', publishedAfter)
        url.searchParams.set('regionCode', 'US')
        url.searchParams.set('relevanceLanguage', 'en')
        url.searchParams.set('maxResults', '10')
        url.searchParams.set('key', apiKey)

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
        if (!res.ok) {
          errors.push(`YouTube search [${label}]: HTTP ${res.status}`)
          return
        }

        const json = await res.json()
        for (const item of json.items ?? []) {
          const videoId: string = item.id?.videoId ?? ''
          if (!videoId || seen.has(videoId)) continue
          seen.add(videoId)
          snippetMap.set(videoId, {
            title: item.snippet?.title ?? '',
            description: item.snippet?.description ?? '',
            channelTitle: item.snippet?.channelTitle ?? '',
            publishedAt: item.snippet?.publishedAt ?? '',
          })
        }
      } catch (err) {
        errors.push(`YouTube search [${label}]: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  )

  if (snippetMap.size === 0) return

  // Step 2: batch fetch view counts — videos.list max is 50 IDs per request
  const allIds = [...snippetMap.keys()]
  const chunks: string[][] = []
  for (let i = 0; i < allIds.length; i += 50) chunks.push(allIds.slice(i, i + 50))

  for (const chunk of chunks) {
    try {
      const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
      statsUrl.searchParams.set('part', 'statistics')
      statsUrl.searchParams.set('id', chunk.join(','))
      statsUrl.searchParams.set('key', apiKey)

      const res = await fetch(statsUrl.toString(), { signal: AbortSignal.timeout(8000) })
      if (!res.ok) {
        errors.push(`YouTube stats batch: HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      for (const item of json.items ?? []) {
        const videoId: string = item.id ?? ''
        const snippet = snippetMap.get(videoId)
        if (!snippet) continue

        clips.push({
          title: snippet.title,
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          platform: 'youtube',
          viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
          channelTitle: snippet.channelTitle,
          description: snippet.description,
          publishedAt: snippet.publishedAt,
          journalistUsername: null,
        })
      }
    } catch (err) {
      errors.push(`YouTube stats batch: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
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
