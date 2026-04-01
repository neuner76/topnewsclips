// Global Lens — international news sources tagged by region
// Uses Reddit (PullPush) + YouTube RSS (quota-free) for each region

export interface GlobalClip {
  title: string
  videoUrl: string
  platform: 'youtube' | 'tiktok' | 'x'
  score: number
  source: string
  videoId: string | null
  region: string
  description: string
}

const VIDEO_DOMAINS = ['youtube.com', 'youtu.be', 'tiktok.com', 'tiktokv.com', 'twitter.com', 'x.com']
const MIN_SCORE = 50 // lower threshold for international content

// Trimmed to highest-signal subreddits — fewer requests = fewer 429s
const GLOBAL_SUBREDDITS: { subreddit: string; region: string }[] = [
  { subreddit: 'worldnews',    region: 'World' },
  { subreddit: 'korea',        region: 'Korea' },
  { subreddit: 'middleeast',   region: 'Middle East' },
  { subreddit: 'europe',       region: 'Europe' },
  { subreddit: 'China',        region: 'China' },
  { subreddit: 'africa',       region: 'Africa' },
  { subreddit: 'LatinAmerica', region: 'Latin America' },
]

// YouTube RSS channels for international outlets (quota-free)
const GLOBAL_YOUTUBE_CHANNELS: { channelId: string; region: string; label: string }[] = [
  { channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg', region: 'Middle East',   label: 'Al Jazeera English' },
  { channelId: 'UCknLrEdhRCp1aegoMqRaCZg', region: 'Europe',        label: 'DW News' },
  { channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', region: 'Europe',        label: 'France 24 English' },
  { channelId: 'UCip8ve30-AoX2y2OtAAmqFA', region: 'Japan',         label: 'NHK World News' },
  { channelId: 'UCzznO4xSV8BKnUBPyswtCUw', region: 'Korea',         label: 'Arirang News' },
  { channelId: 'UC7fWeaHhqgM4Ry-RMpM2YYw', region: 'Middle East',   label: 'TRT World' },
  { channelId: 'UCVgO39Bk5sMo66-6o6Spn6Q', region: 'Australia',     label: 'ABC News Australia' },
  { channelId: 'UC_gUM8rL-Lrg6O3adPW9K1g', region: 'South Asia',   label: 'WION' },
  { channelId: 'UC1_E8NeF5QHY2dtdLRBCCLA', region: 'Africa',       label: 'Africanews' },
]

function detectPlatform(url: string): 'youtube' | 'tiktok' | 'x' | null {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com') || url.includes('tiktokv.com')) return 'tiktok'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'x'
  return null
}

function extractVideoId(url: string, platform: 'youtube' | 'tiktok' | 'x'): string | null {
  if (platform === 'youtube') {
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
  }
  if (platform === 'tiktok') {
    const m = url.match(/\/video\/(\d+)/)
    return m ? m[1] : null
  }
  if (platform === 'x') {
    const m = url.match(/\/status\/(\d+)/)
    return m ? m[1] : null
  }
  return null
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


async function fetchGlobalSubreddit(subreddit: string, region: string): Promise<{ clips: GlobalClip[]; error: string | null }> {
  const clips: GlobalClip[] = []
  try {
    // Use Reddit's own public JSON API — more reliable than PullPush
    const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=25`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'topnewsclips/1.0 (news aggregator)' },
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return { clips, error: `Global Reddit r/${subreddit}: HTTP ${res.status}` }

    const json = await res.json()
    const posts: Record<string, unknown>[] = (json?.data?.children ?? []).map((c: Record<string, unknown>) => c.data as Record<string, unknown>)

    for (const post of posts) {
      if (!post?.url) continue
      if ((post.score as number ?? 0) < MIN_SCORE) continue
      if (post.over_18) continue

      const videoUrl = post.url as string
      if (!VIDEO_DOMAINS.some(d => videoUrl.includes(d))) continue

      const platform = detectPlatform(videoUrl)
      if (!platform) continue

      const cleanedTitle = cleanTitle((post.title as string) ?? '')
      if (isUSDomesticStory(cleanedTitle)) continue

      clips.push({
        title: cleanedTitle,
        videoUrl,
        platform,
        score: (post.score as number) ?? 0,
        source: `r/${subreddit}`,
        videoId: extractVideoId(videoUrl, platform),
        region,
        description: '',
      })
    }
    return { clips, error: null }
  } catch (err) {
    return { clips, error: `Global Reddit r/${subreddit}: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function fetchGlobalReddit(
  clips: GlobalClip[],
  errors: string[],
  seen: Set<string>
) {
  const results = await Promise.all(GLOBAL_SUBREDDITS.map(({ subreddit, region }) => fetchGlobalSubreddit(subreddit, region)))

  for (const { clips: batch, error } of results) {
    if (error) { errors.push(error); continue }
    for (const clip of batch) {
      if (seen.has(clip.videoUrl)) continue
      seen.add(clip.videoUrl)
      clips.push(clip)
    }
  }
}

// Strip common channel name suffixes from YouTube titles e.g. "Story title | DW News" → "Story title"
function cleanTitle(title: string): string {
  return title.replace(/\s*[|\-–—]\s*(DW News|Al Jazeera English|FRANCE 24 English|FRANCE 24|NHK World|NHK|Arirang News|Arirang|TRT World|ABC News Australia|ABC News|CGTN|WION|TeleSUR English|TeleSUR)(\s+English)?\s*$/i, '').trim()
}

// Pre-filter: skip stories that are clearly about US domestic politics/news
// These come from international outlets covering the US — not useful for Global Lens
const US_DOMESTIC_TERMS = [
  // US politics
  /\bICE\b/, /\bTrump\b/, /\bBiden\b/, /\bCongress\b/, /\bSenate\b/, /\bWhite House\b/i,
  /\bDOGE\b/, /\bElon Musk\b/i, /\bDemocrat/i, /\bRepublican/i, /\bGOP\b/,
  /\bSupreme Court\b/i, /\bWall Street\b/i, /\bFed(eral Reserve)?\b/,
  // US cities and locations
  /\bNew York\b/i, /\bLos Angeles\b/i, /\bChicago\b/i, /\bHouston\b/i,
  /\bWashington D\.?C\.?\b/i, /\bLas Vegas\b/i, /\bMiami\b/i, /\bBoston\b/i,
  /\bSan Francisco\b/i, /\bSeattle\b/i, /\bDallas\b/i, /\bAtlanta\b/i,
  /\bLaGuardia\b/i, /\bJFK Airport\b/i, /\bO'Hare\b/i,
  // US institutions
  /\bFBI\b/, /\bCIA\b/, /\bNSA\b/, /\bDHS\b/, /\bDOJ\b/,
  /\bPentagon\b/i, /\bU\.S\. Capitol\b/i,
]

function isUSDomesticStory(title: string): boolean {
  return US_DOMESTIC_TERMS.some(re => re.test(title))
}

// Uses YouTube Data API playlistItems — 1 quota unit per channel, reliable from cloud IPs
// Each channel's uploads playlist ID = 'UU' + channelId.slice(2)
async function fetchGlobalYouTubeAPI(
  apiKey: string,
  clips: GlobalClip[],
  errors: string[],
  seen: Set<string>
) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  for (const { channelId, region, label } of GLOBAL_YOUTUBE_CHANNELS) {
    try {
      const uploadsPlaylistId = 'UU' + channelId.slice(2)
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('playlistId', uploadsPlaylistId)
      url.searchParams.set('maxResults', '10')
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })

      if (!res.ok) {
        errors.push(`Global YouTube API ${label}: HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      for (const item of json.items ?? []) {
        const snippet = item.snippet
        const videoId: string = snippet?.resourceId?.videoId ?? ''
        if (!videoId || seen.has(videoId)) continue

        const published: string = snippet?.publishedAt ?? ''
        if (published && published < cutoff) continue

        const cleanedTitle = cleanTitle(snippet?.title ?? '').slice(0, 200)
        // Do NOT filter US-topic coverage from public broadcaster YouTube channels —
        // international outlets covering US events are exactly what "How the World Sees It" needs.
        // (Reddit posts still get filtered via fetchGlobalSubreddit to reduce noise.)

        seen.add(videoId)
        clips.push({
          title: cleanedTitle,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          platform: 'youtube',
          score: 0, // playlistItems doesn't return view counts — MSM check will evaluate importance
          source: `YouTube/${label}`,
          videoId,
          region,
          description: (snippet?.description ?? '').slice(0, 500),
        })
      }
    } catch (err) {
      errors.push(`Global YouTube API ${label}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

async function backfillViewCounts(clips: GlobalClip[], apiKey: string): Promise<void> {
  const youtubeClips = clips.filter(c => c.platform === 'youtube' && c.videoId && c.score === 0)
  if (youtubeClips.length === 0) return

  const ids = youtubeClips.map(c => c.videoId!)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))

  const viewMap = new Map<string, number>()
  await Promise.all(chunks.map(async chunk => {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'statistics')
      url.searchParams.set('id', chunk.join(','))
      url.searchParams.set('key', apiKey)
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return
      const json = await res.json()
      for (const item of json.items ?? []) {
        viewMap.set(item.id, parseInt(item.statistics?.viewCount ?? '0', 10))
      }
    } catch { /* non-fatal */ }
  }))

  for (const clip of youtubeClips) {
    if (clip.videoId && viewMap.has(clip.videoId)) {
      clip.score = viewMap.get(clip.videoId)!
    }
  }
}

export async function fetchGlobalClips(apiKey?: string): Promise<{ clips: GlobalClip[]; errors: string[] }> {
  const clips: GlobalClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  await Promise.all([
    fetchGlobalReddit(clips, errors, seen),
    apiKey
      ? fetchGlobalYouTubeAPI(apiKey, clips, errors, seen)
      : Promise.resolve(errors.push('YOUTUBE_API_KEY not set — skipping global YouTube channels')),
  ])

  // Backfill view counts for YouTube clips (playlistItems doesn't return statistics)
  if (apiKey) await backfillViewCounts(clips, apiKey)

  return { clips, errors }
}
