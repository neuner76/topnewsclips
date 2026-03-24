import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export interface NeedToKnowItem {
  sectionTitle: string   // short punchy label e.g. "Trump Boots Noem"
  slug: string           // links to /story/[slug]
  paragraphs: string[]   // 2-4 full paragraphs
}

export interface InTheKnowItem {
  text: string
  slug: string | null
}

export interface GlobalBlindspotItem {
  region: string
  title: string
  slug: string
  summary: string
}

export interface DigestContent {
  needToKnow: NeedToKnowItem[]
  inTheKnow: {
    'Politics & World Affairs': InTheKnowItem[]
    'Science & Technology': InTheKnowItem[]
    'Business & Markets': InTheKnowItem[]
    'Sports, Entertainment, & Culture': InTheKnowItem[]
  }
  etcetera: string[]
  globalBlindspots?: GlobalBlindspotItem[]
}

export interface Digest {
  id: string
  date: string
  content: DigestContent
  generated_at: string
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function generateAndStoreDigest(): Promise<Digest> {
  const supabase = getSupabase()
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const today = new Date().toISOString().split('T')[0]

  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, title, slug, description, category, journalist_username, msm_gap, region')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('display_order', { ascending: true })
    .order('view_count', { ascending: false })
    .limit(40)

  if (error) throw new Error(`Failed to fetch stories: ${error.message}`)
  if (!stories || stories.length === 0) throw new Error('No published stories to digest')

  // Fetch global blindspot stories separately
  const { data: globalStories } = await supabase
    .from('stories')
    .select('slug, title, description, region')
    .eq('published', true)
    .eq('msm_gap', true)
    .not('region', 'is', null)
    .order('view_count', { ascending: false })
    .limit(8)

  const storiesForPrompt = stories
    .filter(s => !s.region)
    .map(s => ({
      slug: s.slug,
      title: s.title,
      summary: s.description,
      category: s.category,
      isJournalist: !!s.journalist_username,
      msmGap: s.msm_gap,
    }))

  const globalForPrompt = (globalStories ?? []).map(s => ({
    slug: s.slug,
    title: s.title,
    summary: s.description,
    region: s.region,
  }))

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are writing a daily newsletter digest for TopNewsClips — a site that surfaces independent journalism, viral news footage, and global stories that mainstream US media undercovers.

Produce a structured JSON digest from the stories below. Follow these rules exactly:

NEED TO KNOW (3 stories max):
- Pick the 3 most important/interesting stories from the US STORIES section
- "sectionTitle": 3-5 word punchy label (e.g. "Trump Boots Noem", "Moon Beans", "China Growth Slowdown")
- "paragraphs": 2-4 full paragraphs expanding on the story — include key facts, numbers, context, and why it matters. Write like 1440 Daily Digest: smart, neutral, thorough. Never vague.
- Use the slug field from the input exactly as-is

IN THE KNOW:
- Remaining US stories as 1-sentence bullets under the correct topic category
- Each sentence should end with (More)
- Assign each story to the best-fitting category
- "slug" should be the story's slug, or null if it doesn't fit

ETCETERA:
- 3-5 short, curious, or surprising one-liners from any remaining US stories that have a quirky/unexpected angle
- Plain strings, no slugs needed

GLOBAL BLINDSPOT (only if GLOBAL STORIES are provided):
- 1-sentence summary per global story explaining what's happening and why Americans should care
- Use the slug and region fields from the input exactly as-is
- "summary" should be one punchy sentence — what happened and why it matters globally

Return ONLY valid JSON in this exact structure:
{
  "needToKnow": [
    { "sectionTitle": "...", "slug": "...", "paragraphs": ["...", "..."] }
  ],
  "inTheKnow": {
    "Politics & World Affairs": [{ "text": "...", "slug": "..." }],
    "Science & Technology": [{ "text": "...", "slug": "..." }],
    "Business & Markets": [{ "text": "...", "slug": "..." }],
    "Sports, Entertainment, & Culture": [{ "text": "...", "slug": "..." }]
  },
  "etcetera": ["...", "..."],
  "globalBlindspots": [
    { "region": "...", "title": "...", "slug": "...", "summary": "..." }
  ]
}

If there are no global stories, return "globalBlindspots": [].

US STORIES:
${JSON.stringify(storiesForPrompt, null, 2)}
${globalForPrompt.length > 0 ? `\nGLOBAL STORIES (US media is not covering these):\n${JSON.stringify(globalForPrompt, null, 2)}` : ''}`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let content: DigestContent
  try {
    content = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`)
  }

  // Upsert by date — regenerating today's digest overwrites the previous one
  const { data: digest, error: insertError } = await supabase
    .from('digests')
    .upsert({ date: today, content }, { onConflict: 'date' })
    .select()
    .single()

  if (insertError) throw new Error(`Failed to store digest: ${insertError.message}`)

  return digest as Digest
}

export async function getLatestDigest(): Promise<Digest | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('digests')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  return (data as Digest) ?? null
}
