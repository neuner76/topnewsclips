export interface TikTokClip {
  title: string
  videoId: string
  videoUrl: string
  platform: 'tiktok'
  viewCount: number
  authorName: string
  description: string
}

// Hashtags that surface US news / incident / positive innovation content
const HASHTAGS = [
  'bodycam',
  'caughtoncamera',
  'policeincident',
  'dashcam',
  'breakingnews',
]

export async function fetchTikTokTrending(apiKey: string): Promise<{ clips: TikTokClip[]; errors: string[] }> {
  const clips: TikTokClip[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  try {
    const url = new URL(
      'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items'
    )
    url.searchParams.set('token', apiKey)
    url.searchParams.set('timeout', '7')
    url.searchParams.set('memory', '256')

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: HASHTAGS,
        resultsPerPage: 10,
        maxProfilesPerQuery: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const body = await res.text()
      errors.push(`Apify TikTok: HTTP ${res.status} - ${body.slice(0, 120)}`)
      return { clips, errors }
    }

    const items = await res.json()

    if (!Array.isArray(items)) {
      errors.push('Apify TikTok: unexpected response format')
      return { clips, errors }
    }

    for (const item of items) {
      const videoId: string = String(item.id ?? '')
      if (!videoId || seen.has(videoId)) continue

      const playCount = Number(item.playCount ?? item.stats?.playCount ?? 0)
      if (playCount < 100000) continue

      // Skip non-English content
      const text: string = item.text ?? ''
      if (/[\u0600-\u0DFF\u0900-\u097F\u4E00-\u9FFF]/.test(text)) continue

      const authorName: string = item.authorMeta?.name ?? item.author?.uniqueId ?? 'unknown'
      const videoUrl = `https://www.tiktok.com/@${authorName}/video/${videoId}`

      seen.add(videoId)
      clips.push({
        title: text.slice(0, 200) || `TikTok by @${authorName}`,
        videoId,
        videoUrl,
        platform: 'tiktok',
        viewCount: playCount,
        authorName,
        description: text.slice(0, 500),
      })
    }
  } catch (err) {
    errors.push(`Apify TikTok error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { clips, errors }
}
