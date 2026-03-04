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

export async function fetchYouTubeTrending(
  _apiKey: string,
  journalists: { username: string; channelId: string }[] = []
): Promise<{ clips: YouTubeClip[]; errors: string[] }> {
  const clips: YouTubeClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

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
