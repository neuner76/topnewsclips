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
  'bodycam',
  'caughtoncamera',
  'policeincident',
  'policechase',
  'arrestvideo',
]

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
          // Lower threshold for featured journalists
          const authorUniqueId: string =
            (item.authorMeta?.uniqueId ?? item.author?.uniqueId ?? '').toLowerCase()
          const isJournalist = journalistSet.has(authorUniqueId)

          if (!isJournalist && playCount < 100000) continue

          // Skip non-English content
          const text: string = item.text ?? ''
          if (/[\u0600-\u0DFF\u0900-\u097F\u4E00-\u9FFF]/.test(text)) continue

          const authorName: string = item.authorMeta?.name ?? item.author?.uniqueId ?? 'unknown'
          const videoUrl = `https://www.tiktok.com/@${authorName}/video/${videoId}`

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
        profiles: profiles.length > 0 ? profiles : undefined,
        resultsPerPage: 10,
        maxProfilesPerQuery: 1,
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
