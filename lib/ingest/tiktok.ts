export interface TikTokClip {
  title: string
  videoId: string
  videoUrl: string
  platform: 'tiktok'
  viewCount: number
  authorName: string
  description: string
  thumbnailUrl: string | null
  journalistUsername: string | null
}

// Hashtags that surface US news / incident / positive innovation content
const HASHTAGS = [
  // Incident / accountability
  'bodycam',
  'caughtoncamera',
  'policeincident',
  'policechase',
  'arrestvideo',
  // Hero / rescue (feeds "good" category)
  'rescue',
  'herocop',
  'goodsamaritan',
  'firefighterrescue',
  // Innovation / discovery (feeds "good" category)
  'cleanenergy',
  'newscience',
]

// Known MSM / large-network TikTok accounts to exclude
const MSM_ACCOUNTS = new Set([
  'abc7newsbayarea', 'abc7la', 'abc7chicago', 'abc7ny', 'abc7',
  'cbsnews', 'cbs8sandiego', 'cbsmornings',
  'nbcnews', 'nbc', 'nbcla', 'nbcchicago',
  'foxnews', 'fox5dc', 'fox5ny', 'fox13news',
  'cnn', 'cnni',
  'msnbc',
  'bbcnews', 'bbcbreaking',
  'nytimes', 'washingtonpost', 'usatoday',
  'apnews',
])

const ACTOR_ID = 'clockworks~tiktok-scraper'

/**
 * Async Apify pattern — works within Vercel's 10s function timeout:
 * 1. Collect items from the last SUCCEEDED run (returns immediately from dataset cache)
 * 2. Fire a new async run so fresh results are ready next cycle
 * Results are one fetch cycle (~15-30 min) behind, which is fine for a news feed.
 *
 * @param profiles - Optional list of TikTok @usernames to scrape (featured journalists)
 */
export async function fetchTikTokTrending(
  apiKey: string,
  profiles: string[] = []
): Promise<{ clips: TikTokClip[]; errors: string[] }> {
  const clips: TikTokClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  const journalistSet = new Set(profiles.map(u => u.toLowerCase()))

  // Step 1: collect results from the last successful run
  try {
    const itemsUrl = new URL(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/last/dataset/items`
    )
    itemsUrl.searchParams.set('token', apiKey)
    itemsUrl.searchParams.set('status', 'SUCCEEDED')

    const res = await fetch(itemsUrl.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const items = await res.json()

      if (Array.isArray(items)) {
        for (const item of items) {
          const videoId: string = String(item.id ?? '')
          if (!videoId || seen.has(videoId)) continue

          const playCount = Number(item.playCount ?? item.stats?.playCount ?? 0)
          // Extract username: prefer uniqueId, fall back to parsing webVideoUrl
          // (clockworks~tiktok-scraper uses authorMeta.name as display name, not handle)
          const webVideoUrl: string = item.webVideoUrl ?? ''
          const urlUsername = webVideoUrl.match(/tiktok\.com\/@([^/]+)\//)?.[1]?.toLowerCase() ?? ''
          const authorUniqueId: string =
            (item.authorMeta?.uniqueId ?? item.author?.uniqueId ?? urlUsername).toLowerCase()
          const isJournalist = journalistSet.has(authorUniqueId)

          // Skip MSM accounts unless they're an explicitly featured journalist
          if (!isJournalist && MSM_ACCOUNTS.has(authorUniqueId)) continue

          if (!isJournalist && playCount < 100000) continue

          // Skip non-English content
          const text: string = item.text ?? ''
          if (/[\u0600-\u0DFF\u0900-\u097F\u4E00-\u9FFF]/.test(text)) continue

          // Skip hashtag-only posts (no real content to evaluate) — exempt journalists
          const nonHashtagWords = text.replace(/#\w+/g, '').trim()
          if (!isJournalist && nonHashtagWords.length < 20) continue

          const authorName: string = item.authorMeta?.name ?? authorUniqueId ?? 'unknown'
          const videoUrl = webVideoUrl || `https://www.tiktok.com/@${authorUniqueId || authorName}/video/${videoId}`

          const thumbnailUrl: string | null =
            item.videoMeta?.coverUrl ??
            item.videoMeta?.originCoverUrl ??
            item.covers?.default ??
            null

          seen.add(videoId)
          clips.push({
            title: text.slice(0, 200) || `TikTok by @${authorName}`,
            videoId,
            videoUrl,
            platform: 'tiktok',
            viewCount: playCount,
            authorName,
            description: text.slice(0, 500),
            thumbnailUrl,
            journalistUsername: isJournalist ? authorUniqueId : null,
          })
        }
      }
    } else if (res.status !== 404) {
      // 404 just means no previous run exists yet — not an error
      const body = await res.text()
      errors.push(`Apify TikTok dataset: HTTP ${res.status} - ${body.slice(0, 120)}`)
    }
  } catch (err) {
    errors.push(`Apify TikTok fetch error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Step 2: fire a new async run so data is fresh next cycle
  try {
    const runUrl = new URL(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs`)
    runUrl.searchParams.set('token', apiKey)

    await fetch(runUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: HASHTAGS,
        profiles: profiles.length > 0
          ? profiles.map(u => `https://www.tiktok.com/@${u}`)
          : undefined,
        resultsPerPage: 10,
        maxProfilesPerQuery: 25,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
      }),
      signal: AbortSignal.timeout(5000),
    })
    // We don't await the run to finish — it runs in the background on Apify's servers
  } catch (err) {
    // Non-fatal: we still return whatever clips we collected above
    errors.push(`Apify TikTok start-run error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { clips, errors }
}
