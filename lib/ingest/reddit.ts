// PullPush.io — community Pushshift mirror that archives Reddit posts
// Works from cloud IPs unlike reddit.com which blocks AWS/Vercel

export interface RedditClip {
  title: string
  videoUrl: string
  platform: 'youtube' | 'tiktok' | 'x'
  redditScore: number
  subreddit: string
  redditPermalink: string
  videoId: string | null
}

const SUBREDDITS = [
  'PublicFreakout',
  'bodycam',
  'ActualPublicFreakouts',
  'IDontWorkHereLady',
  'CaughtOnCamera',
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

  // 7 days ago as Unix timestamp
  const after = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)

  for (const subreddit of SUBREDDITS) {
    try {
      const url = new URL('https://api.pullpush.io/reddit/search/submission/')
      url.searchParams.set('subreddit', subreddit)
      url.searchParams.set('sort', 'score')
      url.searchParams.set('sort_type', 'desc')
      url.searchParams.set('size', '25')
      url.searchParams.set('after', String(after))

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'topnewsclips/1.0' },
      })

      if (!res.ok) {
        errors.push(`PullPush r/${subreddit}: HTTP ${res.status}`)
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

        clips.push({
          title: (post.title as string) ?? '',
          videoUrl,
          platform,
          redditScore: (post.score as number) ?? 0,
          subreddit,
          redditPermalink: `https://reddit.com${post.permalink as string}`,
          videoId: extractVideoId(videoUrl, platform),
        })
      }
    } catch (err) {
      errors.push(`PullPush r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { clips, errors }
}
