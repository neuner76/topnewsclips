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

const GLOBAL_SUBREDDITS: { subreddit: string; region: string }[] = [
  { subreddit: 'korea',       region: 'Korea' },
  { subreddit: 'koreanews',   region: 'Korea' },
  { subreddit: 'China',       region: 'China' },
  { subreddit: 'Sino',        region: 'China' },
  { subreddit: 'HongKong',    region: 'China' },
  { subreddit: 'middleeast',  region: 'Middle East' },
  { subreddit: 'iran',        region: 'Middle East' },
  { subreddit: 'Israel',      region: 'Middle East' },
  { subreddit: 'europe',      region: 'Europe' },
  { subreddit: 'japan',       region: 'Japan' },
  { subreddit: 'worldnews',   region: 'World' },
]

// YouTube RSS channels for international outlets (quota-free)
const GLOBAL_YOUTUBE_CHANNELS: { channelId: string; region: string; label: string }[] = [
  { channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg', region: 'Middle East', label: 'Al Jazeera English' },
  { channelId: 'UCknLrEdhRCp1aegoMqRaCZg', region: 'Europe',      label: 'DW News' },
  { channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', region: 'Europe',      label: 'France 24 English' },
  { channelId: 'UCip8ve30-AoX2y2OtAAmqFA', region: 'Japan',       label: 'NHK World News' },
  { channelId: 'UCzznO4xSV8BKnUBPyswtCUw', region: 'Korea',       label: 'Arirang News' },
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

async function fetchGlobalReddit(
  clips: GlobalClip[],
  errors: string[],
  seen: Set<string>
) {
  const after = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)

  for (const { subreddit, region } of GLOBAL_SUBREDDITS) {
    try {
      const url = new URL('https://api.pullpush.io/reddit/search/submission/')
      url.searchParams.set('subreddit', subreddit)
      url.searchParams.set('sort', 'score')
      url.searchParams.set('sort_type', 'desc')
      url.searchParams.set('size', '15')
      url.searchParams.set('after', String(after))

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'topnewsclips/1.0' },
      })

      if (!res.ok) {
        errors.push(`Global PullPush r/${subreddit}: HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      const posts: Record<string, unknown>[] = json?.data ?? []

      for (const post of posts) {
        if (!post?.url) continue
        if ((post.score as number ?? 0) < MIN_SCORE) continue
        if (post.over_18) continue

        const videoUrl = post.url as string
        if (!VIDEO_DOMAINS.some(d => videoUrl.includes(d))) continue

        const platform = detectPlatform(videoUrl)
        if (!platform) continue

        if (seen.has(videoUrl)) continue
        seen.add(videoUrl)

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
    } catch (err) {
      errors.push(`Global PullPush r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

// Strip common channel name suffixes from YouTube titles e.g. "Story title | DW News" → "Story title"
function cleanTitle(title: string): string {
  return title.replace(/\s*[|\-–—]\s*(DW News|Al Jazeera English|FRANCE 24 English|FRANCE 24|NHK World|NHK|Arirang News|Arirang)(\s+English)?\s*$/i, '').trim()
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
        if (isUSDomesticStory(cleanedTitle)) continue

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

  return { clips, errors }
}
