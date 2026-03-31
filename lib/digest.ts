import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

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

export interface GlobalLensItem {
  region: string
  slug: string
  title: string
  summary: string  // one sentence: how this region frames the story differently from US coverage
}

export interface EtceteraItem {
  text: string
  slug: string | null
}

export interface MainstreamPulseItem {
  headline: string
  source: string
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
  mainstreamPulse?: MainstreamPulseItem[]
  globalBlindspots?: GlobalBlindspotItem[]
  globalLens?: GlobalLensItem[]
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

async function fetchMainstreamPulse(): Promise<MainstreamPulseItem[]> {
  try {
    const res = await fetch(
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
      { headers: { 'User-Agent': 'TopNewsClips/1.0' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.split('<item>').slice(1, 6) // top 5, pick best 3 below
    const results: MainstreamPulseItem[] = []
    for (const item of items) {
      const titleRaw = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
      const sourceRaw = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? ''
      // Google News titles are "Headline - Source Name" — strip the source suffix
      const headline = titleRaw.replace(/\s*-\s*[^-]+$/, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
      const source = sourceRaw.replace(/&amp;/g, '&').trim()
      if (headline && source) results.push({ headline, source })
      if (results.length >= 3) break
    }
    return results
  } catch {
    return []
  }
}

export async function generateAndStoreDigest(): Promise<Digest> {
  const supabase = getSupabase()
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // Use US Eastern time for the date — GitHub Actions runs in UTC, which rolls over
  // to the next day at 7pm ET, causing digests generated in the evening to show tomorrow's date.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

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

  // Fetch US and regional stories separately to prevent regional volume crowding out US stories
  const [{ data: usStories, error }, { data: globalStories }, { data: worldViewStories }, mainstreamPulse] = await Promise.all([
    supabase
      .from('stories')
      .select('id, title, slug, description, category, journalist_username, source, msm_gap, region, source_tier, created_at, view_count')
      .eq('published', true)
      .is('region', null)
      .gte('created_at', sevenDaysAgo)
      .order('pinned', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(40),
    // Global blindspot stories
    supabase
      .from('stories')
      .select('slug, title, description, region')
      .eq('published', true)
      .eq('msm_gap', true)
      .not('region', 'is', null)
      .order('view_count', { ascending: false })
      .limit(8),
    // All regional stories as matching pool for "How the World Sees It"
    supabase
      .from('stories')
      .select('slug, title, description, region')
      .eq('published', true)
      .not('region', 'is', null)
      .order('view_count', { ascending: false })
      .limit(20),
    fetchMainstreamPulse(),
  ])

  const stories = usStories

  if (error) throw new Error(`Failed to fetch stories: ${error.message}`)
  if (!stories || stories.length === 0) throw new Error('No published stories to digest')

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

  // Build two lists: fresh stories (NeedToKnow eligible) and all stories (InTheKnow/Etcetera)
  // Hard-exclude yesterday's NeedToKnow slugs from the NeedToKnow pool — don't rely on Claude to honor a flag

  // Tier 7 commentary journalists — have a journalist_username but produce opinion/explainer content
  const COMMENTARY_HANDLES = new Set([
    'breakingpoints', 'ggreenwald', 'audittheaudit', 'caspianreport',
    'johnnyharris', 'polymatter', 'kylescanlon', 'kylascanlon',
    'michaeltracey', 'tarapalmeri', 'wendoverproductions', 'veritasium',
    'whitneywebb', 'jamesfreeman', 'tanglenews', 'patrickboyleonfinance',
    'geohussar', 'iancarrollshow',
    // Tier 6 commercial/explainer — not investigative journalism
    'vox', 'journeymanpictures',
  ])

  function getContentType(s: typeof cappedStories[0]): string {
    if (s.category === 'raw') return 'footage'           // bodycam, dashcam, bystander video
    if (s.category === 'analysis') return 'commentary'   // talking head, explainer, opinion
    if (s.journalist_username) {
      const u = s.journalist_username.toLowerCase()
      if (COMMENTARY_HANDLES.has(u)) return 'commentary' // known opinion/explainer channel
      return 'investigation'                              // nonprofit, OSINT, independent news
    }
    return 'report'                                       // wire, press, institutional report
  }

  const toPromptItem = (s: typeof cappedStories[0]) => ({
    slug: s.slug,
    title: s.title,
    summary: s.description,
    contentType: getContentType(s),  // "footage" | "commentary" | "investigation" | "report"
    source: s.journalist_username ? `@${s.journalist_username}` : (s.source ?? null),
    msmGap: s.msm_gap,
    daysAgo: Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000),
    viewCount: s.view_count ?? 0,
  })

  const NEEDTOKNOW_MAX_AGE_DAYS = 5

  function storyAgeDays(s: typeof cappedStories[0]): number {
    return Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000)
  }

  const freshCandidates = cappedStories
    .filter(s => !yesterdaySlugs.has(s.slug))
    // Hard age cap: stories older than 5 days are not NeedToKnow material
    .filter(s => storyAgeDays(s) <= NEEDTOKNOW_MAX_AGE_DAYS)
    // Sort by tier + recency composite: recent Tier 4 beats stale Tier 3
    .sort((a, b) => {
      const tierA = a.source_tier ?? 99
      const tierB = b.source_tier ?? 99
      const ageA = storyAgeDays(a)
      const ageB = storyAgeDays(b)
      // Each day over 2 adds 2 penalty points to effective tier score
      const scoreA = tierA + Math.max(0, ageA - 2) * 2
      const scoreB = tierB + Math.max(0, ageB - 2) * 2
      return scoreA - scoreB
    })
  const needToKnowCandidates = freshCandidates.map(toPromptItem)
  const storiesForPrompt = cappedStories.map(toPromptItem)

  // Slug → contentType map for post-generation enforcement
  const candidateContentType = new Map(freshCandidates.map(s => [s.slug, getContentType(s)]))

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

IMPORTANT: Respond with valid JSON only. Do not include any reasoning, explanation, or text before or after the JSON object.

Produce a structured JSON digest from the stories below. Follow these rules exactly:

NEED TO KNOW (3 stories max):
- Pick the 3 most important/interesting stories from the NEED TO KNOW CANDIDATES section
- InTheKnow and Etcetera must use stories from the ALL US STORIES section (which includes all candidates)
- STRICT SOURCE DIVERSITY: Maximum 1 story per journalist/creator across the ENTIRE digest (NeedToKnow + InTheKnow + Etcetera combined). If a journalist appears in NeedToKnow, do not reference them anywhere else.
- RECENCY — HARD CONSTRAINT: Each story has a "daysAgo" field. Strongly prefer stories with daysAgo ≤ 2. Do NOT pick a story with daysAgo > 3 unless there are genuinely no stories with daysAgo ≤ 3 available. A 7-day-old minor incident is never NeedToKnow material. A 4-day-old story is only acceptable if it is exceptionally high-impact (major ongoing conflict, landmark ruling, breaking investigation).
- IMPACT SIGNAL: Each story has a "viewCount" field. All else equal, prefer higher viewCount — it is a signal that the story has real-world resonance.
- MIX RULE — HARD CONSTRAINT: Each story has a "contentType" field: "footage", "commentary", "investigation", or "report". You MUST NOT pick 3 stories that are all "commentary". Count your picks before finalizing: if all 3 are "commentary", replace the weakest commentary pick with the highest-impact "footage", "investigation", or "report" story in the candidates list — even if it seems less important. A digest of 3 talking-head videos fails the reader.
- TOPIC DIVERSITY: All 3 NeedToKnow stories must cover different topics. Do not pick 3 stories that all critique the same type of institution (e.g. 3 stories about government overreach, or 3 stories about corporate exploitation). Vary across: government/policy, health/science, economy/business, local accountability, foreign affairs.
- POLITICAL BALANCE — HARD CONSTRAINT: Before finalizing, label each pick as primarily appealing to: (A) left-leaning readers, (B) right-leaning readers, or (C) cross-partisan. You MUST have at least one (C) pick. Cross-partisan stories include: health costs, food prices, local crime/safety, natural disasters, scientific breakthroughs, personal finance. If all 3 are (A) or all 3 are (B), replace the weakest pick with the most cross-partisan story available in the candidates list.
- "sectionTitle": 3-5 word punchy label (e.g. "Trump Boots Noem", "Moon Beans", "China Growth Slowdown")
- "paragraphs": 2-4 full paragraphs expanding on the story — include key facts, numbers, context, and why it matters. Write like 1440 Daily Digest: smart, neutral, thorough. Never vague. The final paragraph must include a "Why this matters to you" sentence connecting the story to something tangible in an American's daily life — their wallet, their rights, their community, or their family. Make it specific and concrete, not generic. Wrong: "This could affect Americans." Right: "If you've driven past a license plate reader this week, your vehicle's location may already be in ICE's database." or "If you have a 401(k), the private equity fees documented here are likely embedded in funds you already own."
- TONE — REPORTER NOT ADVOCATE: Every sentence must describe what the source reports, shows, or claims. Use varied attribution language — do not repeat the same phrase more than once per paragraph. Attribution vocabulary: "reports that", "shows", "according to", "documents", "alleges", "found that", "the video shows", "the analysis finds", "per the report", "the investigation documents", "the explainer notes". FORBIDDEN phrases: "corrosive", "perverse", "troubling", "alarming", "shocking", "raises questions about", "sparks concerns", "drawing attention to", "highlights the need for", "underscores", "exposes" (use "documents" instead), any phrase that implies a conclusion the source didn't explicitly state. Wrong: "financial engineering at its most corrosive." Wrong: "raising questions about institutional transparency." Right: "Harris reports that the financing structure created incentives that, per the video, may prioritize revenue over care." Test every sentence: could a reader of any political affiliation find this sentence editorializing? If yes, rewrite it.
- Use the slug field from the input exactly as-is

IN THE KNOW:
- Remaining US stories as 1-sentence bullets under the correct topic category
- Each sentence should end with (More)
- Each bullet must state a specific fact — name the person, place, number, or finding. Never write a vague bullet like "X documented how Y operates with minimal oversight" — instead say what specifically was found. Wrong: "drew prominent figures to publicly protest a political cause." Right: "Robert De Niro and Al Sharpton led an estimated 15,000-person march in Manhattan opposing [specific policy]."
- SKIP promotional or self-referential content — fundraisers, merchandise sales, podcast subscription drives, and event announcements are not news. Do not include them.
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
- MINIMUM 3, maximum 5 — you must include at least 3 entries. If fewer than 3 quirky stories exist, use the most surprising or unexpected remaining facts from any US story not yet used.
- Short, curious, or surprising one-liners from any remaining US stories
- DEDUPLICATION: Never use a story that already appears in NeedToKnow or InTheKnow — each story slug must appear at most once across the entire digest
- Each entry must be concrete: name the specific fact, number, place, or finding. Never vague.
- Each item: { "text": "...", "slug": "..." } — include the story's slug so we can link to it

GLOBAL BLINDSPOT (only if GLOBAL STORIES are provided):
- 1-sentence summary per global story explaining what's happening and why Americans should care
- Use the slug, region, AND title fields from the input exactly as-is — do NOT rewrite or invent a title
- "summary" must end with a concrete US relevance hook — connect to American wallets, security, rights, or foreign policy. Wrong: "a story Americans should follow." Right: "...a chokepoint that controls 20% of global oil supply, meaning price spikes at the pump could follow within weeks."

HOW THE WORLD SEES IT (only if INTERNATIONAL PERSPECTIVES are provided):
- For each NeedToKnow story, scan INTERNATIONAL PERSPECTIVES for stories that are DIRECTLY about the same event, policy, or entity
- Only add "howWorldSeesIt" if the international story is unambiguously about the same topic — not loosely related, not analogous, not thematically similar. The slug must point to a story actually covering the same subject.
- If 1-3 direct matches exist, add a "howWorldSeesIt" array to that NeedToKnow item
- Each entry: { "region": "...", "slug": "...", "summary": "..." }
- "summary" = one sentence describing how that region/outlet frames the story differently than the US angle
- If no DIRECT topical match exists, omit "howWorldSeesIt" entirely — do NOT add an empty array, do NOT force a connection
- Never reuse a slug already used in globalBlindspots

GLOBAL LENS (only if INTERNATIONAL PERSPECTIVES are provided):
- Pick 3-5 international stories from INTERNATIONAL PERSPECTIVES that are NOT already in globalBlindspots and NOT already used in "howWorldSeesIt"
- These are international outlets covering stories that overlap with today's US news — showing how the same events look from abroad
- Each entry: { "region": "...", "slug": "...", "title": "...", "summary": "..." }
- Use the slug, region, and title fields from the input exactly as-is
- "summary" = one sentence describing the international angle and why it adds perspective for American readers
- If fewer than 3 unused international stories exist, omit "globalLens" entirely
- Never reuse a slug already used in globalBlindspots or howWorldSeesIt

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
  ],
  "globalLens": [
    { "region": "...", "slug": "...", "title": "...", "summary": "..." }
  ]
}

If there are no global stories, return "globalBlindspots": [] and omit "globalLens".
If there are no international perspective matches for a NeedToKnow story, omit "howWorldSeesIt" for that entry.

NEED TO KNOW CANDIDATES (choose NeedToKnow only from this list):
${JSON.stringify(needToKnowCandidates, null, 2)}

ALL US STORIES (use for InTheKnow and Etcetera — includes the candidates above plus yesterday's featured stories):
${JSON.stringify(storiesForPrompt, null, 2)}
${globalForPrompt.length > 0 ? `\nGLOBAL STORIES (US media is not covering these):\n${JSON.stringify(globalForPrompt, null, 2)}` : ''}
${worldViewForPrompt.length > 0 ? `\nINTERNATIONAL PERSPECTIVES (how global outlets cover today's US stories):\n${JSON.stringify(worldViewForPrompt, null, 2)}` : ''}`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  // Extract the JSON object — Claude sometimes prepends reasoning text before the JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const text = jsonMatch ? jsonMatch[0] : raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let content: DigestContent
  try {
    content = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  // Enforce NeedToKnow mix: max 1 commentary — swap extras for best non-commentary candidate
  const MAX_COMMENTARY = 1
  const ntkSlugs = new Set(content.needToKnow.map(i => i.slug))
  const commentaryItems = content.needToKnow.filter(i => candidateContentType.get(i.slug) === 'commentary')

  if (commentaryItems.length > MAX_COMMENTARY) {
    // Find best non-commentary candidate not already in NeedToKnow
    const replacement = freshCandidates.find(s =>
      getContentType(s) !== 'commentary' && !ntkSlugs.has(s.slug)
    )
    if (replacement) {
      // Drop the last (weakest) excess commentary item and add the replacement
      const toRemove = commentaryItems[commentaryItems.length - 1]
      content.needToKnow = content.needToKnow.filter(i => i.slug !== toRemove.slug)
      content.needToKnow.push({
        sectionTitle: replacement.title.slice(0, 60),
        slug: replacement.slug,
        paragraphs: [replacement.description ?? ''],
      })
    }
  }

  // Enforce cross-partisan balance: at least 1 NeedToKnow story must be cross-partisan
  const CROSS_PARTISAN_HANDLES = new Set([
    'policeactivity', 'weathernation', 'revealnews', 'propublica', 'marshall',
    'calmatters', 'texastribune', 'frontlinepbs', 'icijorg', 'forensicarchitecture1967',
  ])
  const CROSS_PARTISAN_KEYWORDS = [
    'police', 'bodycam', 'weather', 'health', 'food price', 'recall',
    'earthquake', 'flood', 'fire', 'crash', 'accident', 'safety',
  ]

  function isCrossPartisan(s: typeof cappedStories[0]): boolean {
    if (s.category === 'raw') return true
    const u = (s.journalist_username ?? '').toLowerCase()
    if (CROSS_PARTISAN_HANDLES.has(u)) return true
    const t = s.title.toLowerCase()
    return CROSS_PARTISAN_KEYWORDS.some(k => t.includes(k))
  }

  const ntkHasCrossPartisan = content.needToKnow.some(i => {
    const s = freshCandidates.find(c => c.slug === i.slug)
    return s ? isCrossPartisan(s) : false
  })

  if (!ntkHasCrossPartisan) {
    const ntkSlugsSet = new Set(content.needToKnow.map(i => i.slug))
    const replacement = freshCandidates.find(s =>
      isCrossPartisan(s) && !ntkSlugsSet.has(s.slug)
    )
    if (replacement) {
      // Remove the weakest pick: prefer removing commentary, otherwise remove last item
      const weakest = content.needToKnow.find(i => candidateContentType.get(i.slug) === 'commentary')
        ?? content.needToKnow[content.needToKnow.length - 1]
      content.needToKnow = content.needToKnow.filter(i => i.slug !== weakest.slug)
      content.needToKnow.push({
        sectionTitle: replacement.title.slice(0, 60),
        slug: replacement.slug,
        paragraphs: [replacement.description ?? ''],
      })
    }
  }

  // Enforce Etcetera minimum: pad with unused candidates if Claude returned fewer than 3
  const PROMO_TERMS = ['portal', 'handbook', 'subscribe', 'patreon', 'merchandise', 'join us', 'sign up', 'newsletter', 'submission']
  const MIN_ETCETERA = 3
  if (content.etcetera.length < MIN_ETCETERA) {
    const etcSlugs = new Set(content.etcetera.map(i => typeof i === 'string' ? null : i.slug).filter(Boolean))
    const ntkAndItkSlugs = new Set([
      ...content.needToKnow.map(i => i.slug),
      ...Object.values(content.inTheKnow).flatMap(items => items.map(i => i.slug).filter(Boolean) as string[]),
    ])
    for (const s of cappedStories) {
      if (content.etcetera.length >= MIN_ETCETERA) break
      if (etcSlugs.has(s.slug) || ntkAndItkSlugs.has(s.slug) || !s.description) continue
      if (PROMO_TERMS.some(t => s.description.toLowerCase().includes(t))) continue
      content.etcetera.push({ text: s.description.slice(0, 180), slug: s.slug })
    }
  }

  // Also filter promo terms from existing Etcetera entries Claude produced
  content.etcetera = content.etcetera.filter(item => {
    const text = (typeof item === 'string' ? item : item.text).toLowerCase()
    return !PROMO_TERMS.some(t => text.includes(t))
  })

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

  // Collect all slugs used in globalBlindspots and globalLens so we can repair hallucinated titles
  const titledSlugs = new Set<string>()
  for (const item of content.globalBlindspots ?? []) titledSlugs.add(item.slug)
  for (const item of content.globalLens ?? []) titledSlugs.add(item.slug)

  // Fetch actual titles from DB and overwrite whatever Claude produced
  if (titledSlugs.size > 0) {
    const { data: dbStories } = await supabase
      .from('stories')
      .select('slug, title')
      .in('slug', [...titledSlugs])

    const titleMap = new Map((dbStories ?? []).map((s: { slug: string; title: string }) => [s.slug, s.title]))

    // Fix globalBlindspots — drop entries where slug doesn't exist in DB or summary is empty
    content.globalBlindspots = (content.globalBlindspots ?? []).filter(item => {
      if (!titleMap.has(item.slug)) return false
      if (!item.summary?.trim()) return false
      item.title = titleMap.get(item.slug)!
      return true
    })

    // Fix globalLens — same: drop unknowns and restore real titles
    content.globalLens = (content.globalLens ?? []).filter(item => {
      if (!titleMap.has(item.slug)) return false
      if (!item.summary?.trim()) return false
      item.title = titleMap.get(item.slug)!
      return true
    })
  }

  // Attach mainstream pulse (fetched independently, not via Claude)
  if (mainstreamPulse.length > 0) content.mainstreamPulse = mainstreamPulse

  // Upsert by date — regenerating today's digest overwrites the previous one
  const { data: digest, error: insertError } = await supabase
    .from('digests')
    .upsert({ date: today, content, generated_at: new Date().toISOString() }, { onConflict: 'date' })
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
