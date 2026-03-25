const INDEXNOW_KEY = '9dac1bf18abf4e84af0e3327ccf75d22'
const SITE_URL = 'https://www.topnewsclips.com'

export async function pingIndexNow(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return

  const urls = slugs.map(slug => `${SITE_URL}/story/${slug}`)

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'www.topnewsclips.com',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(5000),
    })
    // 200 or 202 = accepted; failures are non-critical, don't throw
  } catch {
    // IndexNow is best-effort — never block the pipeline
  }
}
