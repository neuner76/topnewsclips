// Run: node scripts/generate-import.mjs > scripts/import.sql
// Then paste import.sql into Supabase SQL Editor and run it.

import { readFileSync } from 'fs'

const json = JSON.parse(readFileSync('./scripts/favorites.json', 'utf8'))
const list = json['Likes and Favorites']['Favorite Videos']['FavoriteVideoList']

const entries = []

for (const item of list) {
  const date = item.Date
  const url = (item.Link || '').replace(/\/$/, '')
  const idMatch = url.match(/\/video\/(\d+)/)
  if (!idMatch) continue

  const videoId = idMatch[1]
  entries.push({ date, url, videoId })
}

console.log('-- TopNewsClips bulk TikTok import')
console.log(`-- ${entries.length} stories imported as drafts`)
console.log('-- Review and publish each one from the admin panel\n')

console.log('INSERT INTO public.stories')
console.log('  (title, slug, description, embed_url, platform, view_count, share_count, msm_gap, published, display_order, created_at, updated_at)')
console.log('VALUES')

const rows = entries.map(({ date, url, videoId }, i) => {
  const slug = `tiktok-${videoId}`
  const title = `TikTok Clip #${entries.length - i} — Edit this title`
  const ts = new Date(date).toISOString()
  return `  ('${title}', '${slug}', null, '${url}', 'tiktok', 0, 0, false, false, 99, '${ts}', '${ts}')`
})

console.log(rows.join(',\n'))
console.log('ON CONFLICT (slug) DO NOTHING;')
console.log(`\n-- Done. ${entries.length} rows inserted.`)
