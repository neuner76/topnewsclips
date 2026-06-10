// Global Lens — international news sources tagged by region
// Uses YouTube Data API for each region.

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

// Strip common channel name suffixes from YouTube titles e.g. "Story title | DW News" → "Story title"
function cleanTitle(title: string): string {
  return title.replace(/\s*[|\-–—]\s*(DW News|Al Jazeera English|FRANCE 24 English|FRANCE 24|NHK World|NHK|Arirang News|Arirang|TRT World|ABC News Australia|ABC News|CGTN|WION|TeleSUR English|TeleSUR)(\s+English)?\s*$/i, '').trim()
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

  await (apiKey
    ? fetchGlobalYouTubeAPI(apiKey, clips, errors, seen)
    : Promise.resolve(errors.push('YOUTUBE_API_KEY not set — skipping global YouTube channels')))

  // Backfill view counts for YouTube clips (playlistItems doesn't return statistics)
  if (apiKey) await backfillViewCounts(clips, apiKey)

  return { clips, errors }
}
