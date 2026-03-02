const SUBREDDITS = ['news', 'worldnews', 'politics', 'videos', 'conspiracy', 'collapse', 'WatchRedditDie']
const MIN_SCORE = 200
const VIDEO_DOMAINS = ['youtube.com', 'youtu.be', 'tiktok.com', 'tiktokv.com', 'twitter.com', 'x.com', 'v.redd.it']

export interface RedditClip {
  title: string
  videoUrl: string
  platform: 'youtube' | 'tiktok' | 'x'
  redditScore: number
  subreddit: string
  redditPermalink: string
  videoId: string | null
}

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

export async function fetchRedditClips(): Promise<RedditClip[]> {
  const clips: RedditClip[] = []
  const seen = new Set<string>()

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, {
        headers: { 'User-Agent': 'TopNewsClips/1.0 (news aggregator)' },
      })
      if (!res.ok) continue

      const json = await res.json()
      const posts = json?.data?.children ?? []

      for (const { data: post } of posts) {
        if (post.score < MIN_SCORE) continue
        if (post.is_self) continue

        const url: string = post.url || ''
        const isVideoDomain = VIDEO_DOMAINS.some(d => url.includes(d))
        if (!isVideoDomain) continue

        const platform = detectPlatform(url)
        if (!platform) continue

        const videoId = extractVideoId(url, platform)
        const key = `${platform}-${videoId ?? url}`
        if (seen.has(key)) continue
        seen.add(key)

        clips.push({
          title: post.title,
          videoUrl: url,
          platform,
          redditScore: post.score,
          subreddit: post.subreddit,
          redditPermalink: `https://reddit.com${post.permalink}`,
          videoId,
        })
      }
    } catch {
      // skip failed subreddits
    }
  }

  return clips
}
