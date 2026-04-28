import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PULSE_HANDLES = ['npr', 'nytimes', 'associatedpress', 'reuters', 'wsj', 'foxnews']

const { data: journalists } = await supabase
  .from('featured_journalists')
  .select('username, platform, active, source_tier, channel_id')
  .eq('platform', 'youtube')
  .eq('active', true)
  .order('username')

console.log('\n=== All active YouTube journalists ===')
for (const j of journalists ?? []) {
  const isPulse = PULSE_HANDLES.includes(j.username.toLowerCase())
  console.log(`${isPulse ? '★' : ' '} ${j.username} | tier: ${j.source_tier} | channel: ${j.channel_id ? 'set' : 'MISSING'}`)
}

console.log('\n=== Mainstream Pulse handle check ===')
const usernames = (journalists ?? []).map(j => j.username.toLowerCase())
for (const handle of PULSE_HANDLES) {
  const match = usernames.find(u => u === handle)
  console.log(`${handle}: ${match ? '✓ found' : '✗ NOT FOUND'}`)
}

const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
const { data: stories } = await supabase
  .from('stories')
  .select('slug, title, journalist_username, source_type, created_at')
  .eq('published', true)
  .in('journalist_username', PULSE_HANDLES)
  .gte('created_at', twoDaysAgo)
  .order('created_at', { ascending: false })

console.log('\n=== Mainstream Pulse stories in DB (last 48h) ===')
for (const s of stories ?? []) {
  console.log(`${s.journalist_username} | ${s.source_type} | ${s.title.slice(0, 60)}`)
}
if (!stories?.length) console.log('None found')
