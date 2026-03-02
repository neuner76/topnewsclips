// Fetches real titles from TikTok oEmbed API
// Run: node scripts/fetch-titles.mjs 2>scripts/fetch-progress.log > scripts/update-titles.sql
// Progress logs go to stderr, SQL goes to stdout

import { readFileSync, writeFileSync, existsSync } from 'fs'

const json = JSON.parse(readFileSync('./scripts/favorites.json', 'utf8'))
const list = json['Likes and Favorites']['Favorite Videos']['FavoriteVideoList']

// Load cached results so we can resume if interrupted
const cacheFile = './scripts/titles-cache.json'
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}

const delay = ms => new Promise(r => setTimeout(r, ms))

function escapeSQL(str) {
  return str.replace(/'/g, "''")
}

const entries = list
  .map(item => {
    const url = (item.Link || '').replace(/\/$/, '')
    const idMatch = url.match(/\/video\/(\d+)/)
    if (!idMatch) return null
    return { videoId: idMatch[1], slug: `tiktok-${idMatch[1]}` }
  })
  .filter(Boolean)

process.stderr.write(`${entries.length} videos to process\n`)

let fetched = 0
let skipped = 0
let failed = 0

for (let i = 0; i < entries.length; i++) {
  const { videoId, slug } = entries[i]

  if (cache[slug]) {
    skipped++
    continue
  }

  try {
    const url = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/share/video/${videoId}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        cache[slug] = data.title
        fetched++
      }
    } else {
      failed++
    }
  } catch {
    failed++
  }

  // Save cache every 50 fetches
  if ((fetched + failed) % 50 === 0) {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
    process.stderr.write(`[${i + 1}/${entries.length}] fetched=${fetched} failed=${failed} skipped=${skipped}\n`)
  }

  await delay(200)
}

// Final cache save
writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
process.stderr.write(`Done. fetched=${fetched} failed=${failed} skipped=${skipped}\n`)

// Output UPDATE SQL
const updates = Object.entries(cache)
console.log(`-- TopNewsClips title updates — ${updates.length} titles`)
for (const [slug, title] of updates) {
  console.log(`UPDATE public.stories SET title = '${escapeSQL(title)}' WHERE slug = '${slug}';`)
}
