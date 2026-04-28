const ACTOR_ID = 'pintostudio~youtube-transcript-scraper'
const MAX_CHARS = 3000

export async function fetchYouTubeTranscript(
  videoUrl: string,
  apiKey: string
): Promise<string | null> {
  try {
    const url = new URL(`https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`)
    url.searchParams.set('token', apiKey)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return null

    const items = await res.json()
    if (!Array.isArray(items) || items.length === 0) return null

    const segments: { text: string }[] = items[0]?.data
    if (!Array.isArray(segments)) return null

    const text = segments.map(s => s.text).join(' ').trim()
    return text.slice(0, MAX_CHARS) || null
  } catch {
    return null
  }
}
