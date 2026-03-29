import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { recheckMSMCoverage } from './ingest/msm-check'

export interface HowWorldSeesItItem {
  region: string
  slug: string
  summary: string  // one sentence: how this region frames the story differently
}

export interface NeedToKnowItem {
  sectionTitle: string   // short punchy label e.g. "Trump Boots Noem"
  slug: string           // links to /story/[slug]
  paragraphs: string[]   // 2-4 full paragraphs
  howWorldSeesIt?: HowWorldSeesItItem[]  // 0-3 international framings, omitted if no match
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

export interface EtceteraItem {
  text: string
  slug: string | null
}

export interface DigestContent {
  needToKnow: NeedToKnowItem[]
  inTheKnow: {
    'Politics & World Affairs': InTheKnowItem[]
    'Science & Technology': InTheKnowItem[]
    'Business & Markets': InTheKnowItem[]
    'Sports, Entertainment, & Culture': InTheKnowItem[]
  }
  etcetera: EtceteraItem[]
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

  // Fetch the most recent prior digest (not today's) to exclude its NeedToKnow slugs
  const { data: priorDigest } = await supabase
    .from('digests')
    .select('content')
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const yesterdaySlugs = new Set<string>()
  if (priorDigest?.content) {
    const yc = priorDigest.content as DigestContent
    for (const item of yc.needToKnow ?? []) yesterdaySlugs.add(item.slug)
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, title, slug, description, category, journalist_username, source, msm_gap, region')
    .eq('published', true)
    .gte('created_at', sevenDaysAgo)
    .order('pinned', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) throw new Error(`Failed to fetch stories: ${error.message}`)
  if (!stories || stories.length === 0) throw new Error('No published stories to digest')

  // Re-check MSM coverage before building digest — badges reflect morning reality
  await recheckMSMCoverage(supabase, stories.filter(s => !s.region)).catch(() => {})

  // Fetch global blindspot stories separately
  const { data: globalStories } = await supabase
    .from('stories')
    .select('slug, title, description, region')
    .eq('published', true)
    .eq('msm_gap', true)
    .not('region', 'is', null)
    .order('view_count', { ascending: false })
    .limit(8)

  // Fetch all regional stories as matching pool for "How the World Sees It"
  const { data: worldViewStories } = await supabase
    .from('stories')
    .select('slug, title, description, region')
    .eq('published', true)
    .not('region', 'is', null)
    .order('view_count', { ascending: false })
    .limit(20)

  // Cap any single journalist/creator to 1 story — prevents one voice dominating the digest
  const journalistCounts = new Map<string, number>()
  const SOURCE_CAP = 1
  const cappedStories = stories.filter(s => {
    if (!s.journalist_username) return true
    const count = journalistCounts.get(s.journalist_username) ?? 0
    if (count >= SOURCE_CAP) return false
    journalistCounts.set(s.journalist_username, count + 1)
    return true
  })

  // yesterdaySlugs are excluded from NeedToKnow only — still available for InTheKnow/Etcetera
  const storiesForPrompt = cappedStories
    .filter(s => !s.region)
    .map(s => ({
      slug: s.slug,
      title: s.title,
      summary: s.description,
      category: s.category,
      source: s.journalist_username ? `@${s.journalist_username}` : (s.source ?? null),
      isJournalist: !!s.journalist_username,
      msmGap: s.msm_gap,
      featuredYesterday: yesterdaySlugs.has(s.slug),
    }))

  const globalForPrompt = (globalStories ?? []).map(s => ({
    slug: s.slug,
    title: s.title,
    summary: s.description,
    region: s.region,
  }))

  const blindspotSlugs = new Set((globalStories ?? []).map(s => s.slug))
  const worldViewForPrompt = (worldViewStories ?? [])
    .filter(s => !blindspotSlugs.has(s.slug))
    .map(s => ({
      slug: s.slug,
      title: s.title,
      summary: s.description,
      region: s.region,
    }))

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are writing a daily newsletter digest for TopNewsClips — a site that surfaces independent journalism, viral news footage, and global stories that mainstream US media undercovers.

Produce a structured JSON digest from the stories below. Follow these rules exactly:

NEED TO KNOW (3 stories max):
- Pick the 3 most important/interesting stories from the US STORIES section
- YESTERDAY EXCLUSION: Any story with "featuredYesterday": true must NOT be chosen for NeedToKnow. These stories are still eligible and SHOULD be used in InTheKnow and Etcetera.
- STRICT SOURCE DIVERSITY: Maximum 1 story per journalist/creator across the ENTIRE digest (NeedToKnow + InTheKnow + Etcetera combined). If a journalist appears in NeedToKnow, do not reference them anywhere else.
- "sectionTitle": 3-5 word punchy label (e.g. "Trump Boots Noem", "Moon Beans", "China Growth Slowdown")
- "paragraphs": 2-4 full paragraphs expanding on the story — include key facts, numbers, context, and why it matters. Write like 1440 Daily Digest: smart, neutral, thorough. Never vague. The final paragraph must include a "Why this matters to you" sentence connecting the story to something tangible in an American's daily life — their wallet, their rights, their community, or their family. Make it specific and concrete, not generic. Wrong: "This could affect Americans." Right: "If you've driven past a license plate reader this week, your vehicle's location may already be in ICE's database." or "If you have a 401(k), the private equity fees documented here are likely embedded in funds you already own."
- TONE — REPORTER NOT ADVOCATE: Every sentence must describe what the source reports, shows, or claims. Use varied attribution language — do not repeat the same phrase more than once per paragraph. Attribution vocabulary: "reports that", "shows", "according to", "documents", "alleges", "found that", "the video shows", "the analysis finds", "per the report", "the investigation documents", "the explainer notes". FORBIDDEN phrases: "corrosive", "perverse", "troubling", "alarming", "shocking", "raises questions about", "sparks concerns", "drawing attention to", "highlights the need for", "underscores", "exposes" (use "documents" instead), any phrase that implies a conclusion the source didn't explicitly state. Wrong: "financial engineering at its most corrosive." Wrong: "raising questions about institutional transparency." Right: "Harris reports that the financing structure created incentives that, per the video, may prioritize revenue over care." Test every sentence: could a reader of any political affiliation find this sentence editorializing? If yes, rewrite it.
- ETCETERA entries must be specific and concrete — name the place, person, number, or finding. Never write vague one-liners like "raises questions about" or "operates with minimal oversight" without stating what the specific finding is.
- Use the slug field from the input exactly as-is

IN THE KNOW:
- Remaining US stories as 1-sentence bullets under the correct topic category
- Each sentence should end with (More)
- Where natural, work in a brief personal relevance hook — one or two words connecting to the reader's life (e.g. "...affecting millions of workers' retirement accounts" or "...a tactic now used in 40 states including yours")
- TONE RULE applies here too — "reports", "shows", "according to", never editorialize
- SOURCE DIVERSITY RULE applies — if a journalist is already in NeedToKnow, skip their other stories
- "slug" should be the story's slug, or null if it doesn't fit
- Assign each story to EXACTLY ONE category using these strict definitions:
  * "Politics & World Affairs": government, elections, military, geopolitics, law enforcement, police accountability, civil rights, international conflict — INCLUDING Hezbollah, Gaza, Russia, Ukraine, and any police/bodycam accountability story
  * "Science & Technology": research, medicine, space, climate science, AI, tech products, environment
  * "Business & Markets": economy, finance, companies, markets, labor, private equity, corporate news
  * "Sports, Entertainment, & Culture": ONLY sports scores/games/athletes, celebrity news, film, TV, music, arts — NOT law enforcement, military, or politics. If unsure, default to "Politics & World Affairs"

ETCETERA:
- 3-5 short, curious, or surprising one-liners from any remaining US stories that have a quirky/unexpected angle
- DEDUPLICATION: Never use a story that already appears in NeedToKnow or InTheKnow — each story slug must appear at most once across the entire digest
- Each entry must be concrete: name the specific fact, number, place, or finding. Never vague.
- Each item: { "text": "...", "slug": "..." } — include the story's slug so we can link to it

GLOBAL BLINDSPOT (only if GLOBAL STORIES are provided):
- 1-sentence summary per global story explaining what's happening and why Americans should care
- Use the slug and region fields from the input exactly as-is
- "summary" must end with a concrete US relevance hook — connect to American wallets, security, rights, or foreign policy. Wrong: "a story Americans should follow." Right: "...a chokepoint that controls 20% of global oil supply, meaning price spikes at the pump could follow within weeks."

HOW THE WORLD SEES IT (only if INTERNATIONAL PERSPECTIVES are provided):
- For each NeedToKnow story, scan INTERNATIONAL PERSPECTIVES for stories that are DIRECTLY about the same event, policy, or entity
- Only add "howWorldSeesIt" if the international story is unambiguously about the same topic — not loosely related, not analogous, not thematically similar. The slug must point to a story actually covering the same subject.
- If 1-3 direct matches exist, add a "howWorldSeesIt" array to that NeedToKnow item
- Each entry: { "region": "...", "slug": "...", "summary": "..." }
- "summary" = one sentence describing how that region/outlet frames the story differently than the US angle
- If no DIRECT topical match exists, omit "howWorldSeesIt" entirely — do NOT add an empty array, do NOT force a connection
- Never reuse a slug already used in globalBlindspots

Return ONLY valid JSON in this exact structure:
{
  "needToKnow": [
    { "sectionTitle": "...", "slug": "...", "paragraphs": ["...", "..."],
      "howWorldSeesIt": [{ "region": "...", "slug": "...", "summary": "..." }] }
  ],
  "inTheKnow": {
    "Politics & World Affairs": [{ "text": "...", "slug": "..." }],
    "Science & Technology": [{ "text": "...", "slug": "..." }],
    "Business & Markets": [{ "text": "...", "slug": "..." }],
    "Sports, Entertainment, & Culture": [{ "text": "...", "slug": "..." }]
  },
  "etcetera": [{ "text": "...", "slug": "..." }],
  "globalBlindspots": [
    { "region": "...", "title": "...", "slug": "...", "summary": "..." }
  ]
}

If there are no global stories, return "globalBlindspots": [].
If there are no international perspective matches for a NeedToKnow story, omit "howWorldSeesIt" for that entry.

US STORIES:
${JSON.stringify(storiesForPrompt, null, 2)}
${globalForPrompt.length > 0 ? `\nGLOBAL STORIES (US media is not covering these):\n${JSON.stringify(globalForPrompt, null, 2)}` : ''}
${worldViewForPrompt.length > 0 ? `\nINTERNATIONAL PERSPECTIVES (how global outlets cover today's US stories):\n${JSON.stringify(worldViewForPrompt, null, 2)}` : ''}`
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

  // Programmatic deduplication — Claude occasionally repeats slugs or journalists across sections
  const usedSlugs = new Set<string>()

  // NeedToKnow slugs are authoritative — registered first
  for (const item of content.needToKnow) {
    usedSlugs.add(item.slug)
  }

  // InTheKnow: register slugs, skip any already used
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => {
      if (!item.slug) return true
      if (usedSlugs.has(item.slug)) return false
      usedSlugs.add(item.slug)
      return true
    })
  }

  // Etcetera: drop any slug already seen in NeedToKnow or InTheKnow
  content.etcetera = content.etcetera.filter(item => {
    const etc = typeof item === 'string' ? { text: item, slug: null } : item
    if (!etc.slug) return true
    if (usedSlugs.has(etc.slug)) return false
    usedSlugs.add(etc.slug)
    return true
  }) as EtceteraItem[]

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
