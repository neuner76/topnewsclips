// Reddit public JSON API — no OAuth required
// Targets subreddits aligned with viral caught-on-camera US content

export interface RedditClip {
  title: string
  videoUrl: string
  platform: 'youtube' | 'tiktok' | 'x'
  redditScore: number
  subreddit: string
  redditPermalink: string
  videoId: string | null
}

// Subreddits ordered by relevance to site content
const SUBREDDITS = [
  'PublicFreakout',
  'bodycam',
  'Unexpected',
  'IDontWorkHereLady',
  'ActualPublicFreakouts',
]

const MIN_SCORE = 100
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
  const seen = new Set<string>()

  for (const subreddit of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
        headers: {
          'User-Agent': 'web:topnewsclips:v1.0 (news aggregator)',
        },
      })

      if (!res.ok) {
        errors.push(`r/${subreddit}: HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      const posts: Array<{ data: Record<string, unknown> }> = json?.data?.children ?? []

      for (const { data: post } of posts) {
        if (!post?.url) continue
        if ((post.score as number ?? 0) < MIN_SCORE) continue
        if (post.over_18) continue // skip NSFW

        const url = post.url as string
        if (!VIDEO_DOMAINS.some(d => url.includes(d))) continue

        const platform = detectPlatform(url)
        if (!platform) continue

        if (seen.has(url)) continue
        seen.add(url)

        clips.push({
          title: (post.title as string) ?? '',
          videoUrl: url,
          platform,
          redditScore: (post.score as number) ?? 0,
          subreddit,
          redditPermalink: `https://reddit.com${post.permalink as string}`,
          videoId: extractVideoId(url, platform),
        })
      }
    } catch (err) {
      errors.push(`r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { clips, errors }
}
