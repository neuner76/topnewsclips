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
  duration: string | null
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
// Note: science/tech is intentionally omitted — journalist RSS (Veritasium, SciShow, Dr. Campbell)
// produces far cleaner results than search, which floods with clickbait and international content.
const NEWS_SEARCH_QUERIES = [
  // Politics — specific enough to avoid press briefings
  { q: 'senate hearing testimony investigation 2026', label: 'politics' },
  { q: 'congressional hearing whistleblower accountability', label: 'politics' },
  // Incident footage — US-anchored terms reduce international CCTV noise
  { q: 'bodycam footage US police department 2026', label: 'incident' },
  { q: 'police bodycam shooting arrest american', label: 'incident' },
  // Local US news with video
  { q: 'local news caught on video american police fire', label: 'local' },
]

const SEARCH_WINDOW_HOURS = 48

// Known low-quality channels to skip in search results.
// Add channel titles here as you encounter them in reject logs.
const BLOCKED_CHANNEL_TITLES = new Set([
  // Bodycam compilation/reaction channels
  'Zowoki',
  'Core Decode',
  'police usa new',
  'The Crime Chronicles-True crime',
  'police justice body cam',
  // Partisan commentary
  'Really American',
  'Ayyan',
  // Pseudoscience / clickbait / paranormal
  'FactFusion007',
  'Brain_Burst',
  'Modern Love Exposed',
  'Mr Evidence',
  'InOutExposed',
  'Bodycam Detained',
  // Finance influencers
  'SwingTradeShorts',
  'Stocks With Zach',
  'Apex Finance',
])

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
      ? fetchJournalistChannelsViaRSS(journalists, clips, errors, seen, apiKey)
      : Promise.resolve(),
    searchYouTubeNews(apiKey, clips, errors, seen),
  ])

  // Batch-fetch durations for journalist RSS clips (search clips already have duration)
  const needsDuration = clips.filter(c => c.duration === null)
  if (needsDuration.length > 0) {
    const ids = needsDuration.map(c => c.videoId)
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
    const durationMap = new Map<string, string>()
    for (const chunk of chunks) {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos')
        url.searchParams.set('part', 'contentDetails')
        url.searchParams.set('id', chunk.join(','))
        url.searchParams.set('key', apiKey)
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
        if (res.ok) {
          const json = await res.json()
          for (const item of json.items ?? []) {
            if (item.contentDetails?.duration) durationMap.set(item.id, item.contentDetails.duration)
          }
        }
      } catch {
        // non-fatal — duration stays null
      }
    }
    for (const clip of needsDuration) {
      clip.duration = durationMap.get(clip.videoId) ?? null
    }
  }

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
          const channelTitle: string = item.snippet?.channelTitle ?? ''
          if (BLOCKED_CHANNEL_TITLES.has(channelTitle)) continue
          seen.add(videoId)
          snippetMap.set(videoId, {
            title: item.snippet?.title ?? '',
            description: item.snippet?.description ?? '',
            channelTitle,
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
      statsUrl.searchParams.set('part', 'statistics,contentDetails')
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
          duration: item.contentDetails?.duration ?? null,
        })
      }
    } catch (err) {
      errors.push(`YouTube stats batch: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

// RSS feed returns the last 15 videos from a channel — no API key needed, no quota cost.
// Falls back to playlistItems.list (1 quota unit each) if RSS is blocked.
async function fetchJournalistChannelsViaRSS(
  journalists: { username: string; channelId: string }[],
  clips: YouTubeClip[],
  errors: string[],
  seen: Set<string>,
  apiKey: string
) {
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  const RSS_UA = 'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)'

  // Track which channels need API fallback
  const needsApiFallback: { username: string; channelId: string }[] = []

  for (const { username, channelId } of journalists) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      const res = await fetch(rssUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': RSS_UA },
      })

      if (!res.ok) {
        errors.push(`YouTube journalist @${username}: RSS HTTP ${res.status}`)
        needsApiFallback.push({ username, channelId })
        continue
      }

      const xml = await res.text()
      const newClips = parseRSSEntries(xml, username, cutoff, seen)
      clips.push(...newClips)
    } catch (err) {
      errors.push(`YouTube journalist @${username}: ${err instanceof Error ? err.message : String(err)}`)
      needsApiFallback.push({ username, channelId })
    }
  }

  // API fallback: playlistItems.list on the channel's uploads playlist (UCxxx → UUxxx)
  // Costs 1 quota unit per channel, far cheaper than search (100 units).
  if (needsApiFallback.length === 0) return

  const fallbackVideoIds: { username: string; channelId: string; videoId: string; publishedAt: string }[] = []

  await Promise.all(needsApiFallback.map(async ({ username, channelId }) => {
    try {
      const playlistId = channelId.startsWith('UC') ? 'UU' + channelId.slice(2) : channelId
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      url.searchParams.set('part', 'snippet,contentDetails')
      url.searchParams.set('playlistId', playlistId)
      url.searchParams.set('maxResults', '10')
      url.searchParams.set('key', apiKey)
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return // keep original RSS error
      const json = await res.json()
      for (const item of json.items ?? []) {
        const videoId: string = item.contentDetails?.videoId ?? ''
        if (!videoId || seen.has(videoId)) continue
        const publishedAt: string = item.snippet?.publishedAt ?? item.contentDetails?.videoPublishedAt ?? ''
        if (publishedAt && publishedAt < cutoff) continue
        seen.add(videoId)
        fallbackVideoIds.push({ username, channelId, videoId, publishedAt })
        // Remove the RSS error for this channel since API fallback succeeded
        const idx = errors.findIndex(e => e.includes(`@${username}: RSS`))
        if (idx >= 0) errors.splice(idx, 1)
      }
    } catch {
      // keep original RSS error
    }
  }))

  if (fallbackVideoIds.length === 0) return

  // Batch-fetch statistics + contentDetails for fallback clips
  const ids = fallbackVideoIds.map(v => v.videoId)
  const statMap = new Map<string, { viewCount: number; channelTitle: string; title: string; description: string; duration: string | null }>()
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))

  await Promise.all(chunks.map(async chunk => {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet,statistics,contentDetails')
      url.searchParams.set('id', chunk.join(','))
      url.searchParams.set('key', apiKey)
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return
      const json = await res.json()
      for (const item of json.items ?? []) {
        statMap.set(item.id, {
          viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
          channelTitle: item.snippet?.channelTitle ?? '',
          title: item.snippet?.title ?? '',
          description: (item.snippet?.description ?? '').slice(0, 500),
          duration: item.contentDetails?.duration ?? null,
        })
      }
    } catch { /* non-fatal */ }
  }))

  for (const { username, videoId, publishedAt } of fallbackVideoIds) {
    const stat = statMap.get(videoId)
    clips.push({
      title: stat?.title ?? '',
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      platform: 'youtube',
      viewCount: stat?.viewCount ?? 0,
      channelTitle: stat?.channelTitle ?? username,
      description: stat?.description ?? '',
      publishedAt,
      journalistUsername: username,
      duration: stat?.duration ?? null,
    })
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
      duration: null,
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
