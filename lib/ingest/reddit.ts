// HackerNews API — free, reliable, never blocks cloud IPs
// Replaces Reddit which blocks Vercel/AWS server IPs with HTTP 403

export interface RedditClip {
  title: string
  videoUrl: string
  platform: 'youtube' | 'tiktok' | 'x'
  redditScore: number
  subreddit: string
  redditPermalink: string
  videoId: string | null
}

const MIN_SCORE = 50
const VIDEO_DOMAINS = ['youtube.com', 'youtu.be', 'tiktok.com', 'tiktokv.com', 'twitter.com', 'x.com']

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

export async function fetchRedditClips(): Promise<{ clips: RedditClip[]; errors: string[] }> {
  const clips: RedditClip[] = []
  const errors: string[] = []

  try {
    // Fetch top 200 HackerNews story IDs
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    if (!topRes.ok) {
      errors.push(`HackerNews top stories: HTTP ${topRes.status}`)
      return { clips, errors }
    }

    const topIds: number[] = await topRes.json()
    const ids = topIds.slice(0, 100)

    // Fetch story details in parallel batches of 20
    const batchSize = 20
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const items = await Promise.all(
        batch.map(id =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
            .then(r => r.json())
            .catch(() => null)
        )
      )

      for (const item of items) {
        if (!item || item.type !== 'story') continue
        if (!item.url) continue
        if ((item.score ?? 0) < MIN_SCORE) continue

        const url: string = item.url
        const isVideoDomain = VIDEO_DOMAINS.some(d => url.includes(d))
        if (!isVideoDomain) continue

        const platform = detectPlatform(url)
        if (!platform) continue

        const videoId = extractVideoId(url, platform)

        clips.push({
          title: item.title ?? '',
          videoUrl: url,
          platform,
          redditScore: item.score ?? 0,
          subreddit: 'HackerNews',
          redditPermalink: `https://news.ycombinator.com/item?id=${item.id}`,
          videoId,
        })
      }
    }
  } catch (err) {
    errors.push(`HackerNews fetch error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { clips, errors }
}
