import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export interface HowWorldSeesItItem {
  region: string
  slug: string
  title?: string   // story headline — populated post-generation from DB
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
  descriptor: string
}

export interface DigestContent {
  needToKnow: NeedToKnowItem[]
  inTheKnow: {
    'Politics & World Affairs': InTheKnowItem[]
    'Science & Technology': InTheKnowItem[]
    'Business & Markets': InTheKnowItem[]
    'Sports, Entertainment, & Culture': InTheKnowItem[]
    'Comedy & Satire': InTheKnowItem[]
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

const PULSE_OUTLETS = [
  { domain: 'npr.org',      label: 'NPR',      descriptor: 'public media' },
  { domain: 'nytimes.com',  label: 'NYT',      descriptor: 'center-left' },
  { domain: 'apnews.com',   label: 'AP',        descriptor: 'wire' },
  { domain: 'reuters.com',  label: 'Reuters',   descriptor: 'global wire' },
  { domain: 'wsj.com',      label: 'WSJ',       descriptor: 'business' },
  { domain: 'foxnews.com',  label: 'Fox News',  descriptor: 'conservative' },
]

async function fetchMainstreamPulse(): Promise<MainstreamPulseItem[]> {
  function decodeHtml(s: string) {
    return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
  }

  const results = await Promise.all(
    PULSE_OUTLETS.map(async ({ domain, label, descriptor }) => {
      try {
        const res = await fetch(
          `https://news.google.com/rss/search?q=site:${domain}&hl=en-US&gl=US&ceid=US:en`,
          { headers: { 'User-Agent': 'TopNewsClips/1.0' }, signal: AbortSignal.timeout(8000) }
        )
        if (!res.ok) return null
        const xml = await res.text()
        const items = xml.split('<item>').slice(1, 6) // try up to 5 items to skip opinions
        for (const item of items) {
          const titleRaw = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
          // Google News search titles are "Headline - Source Name" — strip the trailing source
          const headline = decodeHtml(titleRaw.replace(/\s*-\s*[^-]+$/, ''))
          if (!headline) continue
          // Skip opinion, editorial, and letter pieces — not news leads
          if (/^(Opinion|Editorial|Letters?|Commentary)\s*[|:]/i.test(headline)) continue
          // Skip navigation/print pages — WSJ and others sometimes return site UI as headlines
          if (headline.length < 25) continue
          if (/print edition|wall street journal|subscribe|log in/i.test(headline)) continue
          return { headline, source: label, descriptor }
        }
        return null
      } catch {
        return null
      }
    })
  )

  return results.filter((r): r is MainstreamPulseItem => r !== null)
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

  // Exclude all slugs that appeared anywhere in yesterday's digest — not just NeedToKnow
  const yesterdaySlugs = new Set<string>()
  if (priorDigest?.content) {
    const yc = priorDigest.content as DigestContent
    for (const item of yc.needToKnow ?? []) yesterdaySlugs.add(item.slug)
    for (const cat of Object.values(yc.inTheKnow ?? {})) {
      for (const item of cat) if (item.slug) yesterdaySlugs.add(item.slug)
    }
    for (const item of yc.etcetera ?? []) {
      const etc = typeof item === 'string' ? null : item.slug
      if (etc) yesterdaySlugs.add(etc)
    }
  }

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // Fetch US and regional stories separately to prevent regional volume crowding out US stories
  const [{ data: usStories, error }, { data: globalStories }, { data: worldViewStories }, mainstreamPulse] = await Promise.all([
    supabase
      .from('stories')
      .select('id, title, slug, description, category, journalist_username, source, msm_gap, region, source_tier, created_at, view_count')
      .eq('published', true)
      .is('region', null)
      .gte('created_at', twoDaysAgo)
      .order('pinned', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(40),
    // Global blindspot stories — last 48 hours only, sorted by recency
    supabase
      .from('stories')
      .select('slug, title, description, region, source_tier, source_type, journalist_username, source, category, msm_outlet_coverage')
      .eq('published', true)
      .eq('msm_gap', true)
      .not('region', 'is', null)
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(8),
    // All regional stories as matching pool for "How the World Sees It" — last 48 hours only
    supabase
      .from('stories')
      .select('slug, title, description, region, source_tier, source_type, journalist_username, source, category, msm_outlet_coverage')
      .eq('published', true)
      .not('region', 'is', null)
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
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
    'breakingpoints', 'ggreenwald', 'glenngreenwald', 'audittheaudit', 'caspianreport',
    'johnnyharris', 'polymatter', 'kylescanlon', 'kylascanlon',
    'michaeltracey', 'tarapalmeri', 'wendoverproductions', 'veritasium',
    'whitneywebb', 'jamesfreeman', 'tanglenews', 'patrickboyleonfinance',
    'geohussar', 'iancarrollshow',
    // Tier 6 commercial/explainer — not investigative journalism
    'vox', 'journeymanpictures',
    // Satire/comedy channels — commentary content, not news
    'thedailyshow', 'lastweektonight', 'joshjohnsoncomedy', 'smn', 'thejuicemedia', 'jonathanpie',
    // Wire/syndication services — footage aggregators, not original journalism
    'storyfulmanagedlicensing', 'storyfulnews', 'storyfulsports',
  ])

  // Satire handles that must never appear in NeedToKnow — enforced post-generation
  const SATIRE_HANDLES = new Set([
    'thedailyshow', 'lastweektonight', 'joshjohnsoncomedy', 'smn', 'thejuicemedia', 'jonathanpie',
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
    hoursAgo: Math.round((Date.now() - new Date(s.created_at).getTime()) / 3600000),
    viewCount: s.view_count ?? 0,
  })

  const NEEDTOKNOW_MAX_AGE_HOURS = 18
  const PROMO_TERMS = ['portal', 'handbook', 'subscribe', 'patreon', 'merchandise', 'join us', 'sign up', 'newsletter', 'submission']

  function storyAgeHours(s: typeof cappedStories[0]): number {
    return (Date.now() - new Date(s.created_at).getTime()) / 3600000
  }

  function sortByTierAndRecency<T extends typeof cappedStories[0]>(stories: T[]): T[] {
    return [...stories].sort((a, b) => {
      const tierA = a.source_tier ?? 99
      const tierB = b.source_tier ?? 99
      const ageA = storyAgeHours(a)
      const ageB = storyAgeHours(b)
      // Each hour over 4 adds 0.5 penalty points to effective tier score
      const scoreA = tierA + Math.max(0, ageA - 4) * 0.5
      const scoreB = tierB + Math.max(0, ageB - 4) * 0.5
      return scoreA - scoreB
    })
  }

  const NEEDTOKNOW_FALLBACK_HOURS = 48  // fallback cap — never pull stories older than 2 days into NeedToKnow

  const nonYesterday = cappedStories.filter(s => !yesterdaySlugs.has(s.slug))
  const withinWindow = nonYesterday.filter(s => storyAgeHours(s) <= NEEDTOKNOW_MAX_AGE_HOURS)
  const withinFallback = nonYesterday.filter(s => storyAgeHours(s) <= NEEDTOKNOW_FALLBACK_HOURS)

  // If ingest hasn't run recently and no stories fall within the window, fall back to last 48 hours (not full 7 days)
  const freshCandidates = sortByTierAndRecency(withinWindow.length >= 3 ? withinWindow : withinFallback)

  // Filter promo-term stories from NeedToKnow candidates — channel descriptions and self-promos shouldn't be NeedToKnow
  // Minimum 150 chars ensures enough source material for Claude to write a real paragraph
  const needToKnowCandidates = freshCandidates
    .filter(s => (s.description?.length ?? 0) >= 150 && !PROMO_TERMS.some(t => (s.description ?? '').toLowerCase().includes(t)))
    .map(toPromptItem)
  const storiesForPrompt = cappedStories.filter(s => !yesterdaySlugs.has(s.slug)).map(toPromptItem)

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

  // Retry on 529 overloaded with exponential backoff
  async function createWithRetry(params: Parameters<typeof claude.messages.create>[0], maxAttempts = 6): Promise<Anthropic.Message> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await claude.messages.create(params) as Anthropic.Message
      } catch (err: unknown) {
        const isOverloaded = err instanceof Error && (err.message.includes('529') || err.message.toLowerCase().includes('overloaded'))
        if (!isOverloaded || attempt === maxAttempts) throw err
        const delay = attempt <= 3 ? 15000 * attempt : 60000 // 15s, 30s, 45s, then 60s each
        console.warn(`Claude overloaded (attempt ${attempt}/${maxAttempts}), retrying in ${delay / 1000}s...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
    throw new Error('Unreachable')
  }

  const response = await createWithRetry({
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
- RECENCY — HARD CONSTRAINT: Each story has a "hoursAgo" field. All NeedToKnow candidates have already been filtered to the last 18 hours. Prefer stories with lower hoursAgo — a story published 2 hours ago is fresher and more urgent than one published 16 hours ago.
- IMPACT SIGNAL: Each story has a "viewCount" field. All else equal, prefer higher viewCount — it is a signal that the story has real-world resonance.
- MIX RULE — HARD CONSTRAINT: Each story has a "contentType" field: "footage", "commentary", "investigation", or "report". You MUST NOT pick 3 stories that are all "commentary". Count your picks before finalizing: if all 3 are "commentary", replace the weakest commentary pick with the highest-impact "footage", "investigation", or "report" story in the candidates list — even if it seems less important. A digest of 3 talking-head videos fails the reader.
- TOPIC DIVERSITY: All 3 NeedToKnow stories must cover different topics. Do not pick 3 stories that all critique the same type of institution (e.g. 3 stories about government overreach, or 3 stories about corporate exploitation). Vary across: government/policy, health/science, economy/business, local accountability, foreign affairs.
- CELEBRITY/ENTERTAINMENT EXCLUSION: Do not place celebrity arrests, DUI incidents, athlete legal trouble, or personal drama in NeedToKnow — even if the story includes bodycam footage. These belong in "Sports, Entertainment, & Culture". A famous person being arrested is not NeedToKnow unless the police conduct itself is the story (explicit misconduct documented on camera).
- SATIRE/COMEDY EXCLUSION — HARD RULE: Never place a satire or comedy source in NeedToKnow. This includes The Daily Show, Last Week Tonight, Jonathan Pie, Some More News, Josh Johnson, The Juice Media, and any other source whose contentType would be "commentary (satire)". NeedToKnow is the editorial standard-setter for the entire page — it must only contain straight reporting (Tiers 1–5) or non-satirical independent commentary (Tier 7). If the only source for a newsworthy topic is a comedy show, move that story to "Comedy & Satire" in InTheKnow and find a straight-reporting source to cover the same topic in NeedToKnow if one exists.
- POLITICAL BALANCE — HARD CONSTRAINT: Before finalizing, label each pick as primarily appealing to: (A) left-leaning readers, (B) right-leaning readers, or (C) cross-partisan. You MUST have at least one (C) pick. Cross-partisan stories include: health costs, food prices, local crime/safety, natural disasters, scientific breakthroughs, personal finance. If all 3 are (A) or all 3 are (B), replace the weakest pick with the most cross-partisan story available in the candidates list.
- "sectionTitle": 3-5 word punchy label (e.g. "Trump Boots Noem", "Moon Beans", "China Growth Slowdown")
- "paragraphs": 2-4 full paragraphs expanding on the story — include key facts, numbers, context, and why it matters. Write like 1440 Daily Digest: smart, neutral, thorough. Never vague. The final paragraph must include a "Why this matters to you" sentence connecting the story to something tangible in an American's daily life — their wallet, their rights, their community, or their family. Make it specific and concrete, not generic. Wrong: "This could affect Americans." Right: "If you've driven past a license plate reader this week, your vehicle's location may already be in ICE's database." or "If you have a 401(k), the private equity fees documented here are likely embedded in funds you already own."
- TONE — REPORTER NOT ADVOCATE: Every sentence must describe what the source reports, shows, or claims. Use varied attribution language — do not repeat the same phrase more than once per paragraph. Attribution vocabulary: "reports that", "shows", "according to", "documents", "alleges", "found that", "the video shows", "the analysis finds", "per the report", "the investigation documents", "the explainer notes". FORBIDDEN phrases: "corrosive", "perverse", "troubling", "alarming", "shocking", "raises questions about", "sparks concerns", "drawing attention to", "highlights the need for", "underscores", "exposes" (use "documents" instead), any phrase that implies a conclusion the source didn't explicitly state. Wrong: "financial engineering at its most corrosive." Wrong: "raising questions about institutional transparency." Right: "Harris reports that the financing structure created incentives that, per the video, may prioritize revenue over care." Test every sentence: could a reader of any political affiliation find this sentence editorializing? If yes, rewrite it.
- Use the slug field from the input exactly as-is

IN THE KNOW:
- RECENCY: Stories have a "hoursAgo" field. Strongly prefer stories under 24 hours old. Only include older stories if they are genuinely significant and not already widely known.
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
  * "Sports, Entertainment, & Culture": ONLY sports scores/games/athletes, celebrity news, film, TV, music, arts — NOT law enforcement, military, or politics. If unsure, default to "Politics & World Affairs". QUALITY BAR: personal relationship drama, memoir backlash, and social media pile-ons do not meet the bar — skip them entirely rather than forcing them into this category.
  * "Comedy & Satire": ONLY for sources whose PRIMARY value is comedic or satirical framing — The Daily Show, Last Week Tonight, Jonathan Pie, Some More News, Josh Johnson, The Juice Media. Do NOT place serious political commentary, opinion journalism, or investigative analysis here even if the contentType is "commentary". Glenn Greenwald, Breaking Points, Caspian Report, and similar opinion/analysis channels belong in "Politics & World Affairs" or "Business & Markets" based on their topic — never in Comedy & Satire.

EDITORIAL MIX RULE — HARD CONSTRAINT:
- IN THE KNOW must include at least TWO non-conflict topic categories even on heavy conflict days. If the day is dominated by Iran/Middle East/war coverage, you MUST still include items in at least two of: Science & Technology, Business & Markets, Sports/Entertainment/Culture, or other non-conflict topics. Do not let a single conflict story crowd out all other categories.
- GLOBAL BLINDSPOT: If 5 or more blindspot items are from the same conflict or region, include at least one story from a different region or topic entirely.
- Do not place stories with direct military or humanitarian significance in Etcetera — promote them to Politics & World Affairs.

ETCETERA:
- MINIMUM 3, maximum 5 — you must include at least 3 entries. If fewer than 3 quirky stories exist, use the most surprising or unexpected remaining facts from any US story not yet used.
- Short, curious, or surprising one-liners from any remaining US stories
- DEDUPLICATION: Never use a story that already appears in NeedToKnow or InTheKnow — each story slug must appear at most once across the entire digest
- Each entry must be concrete: name the specific fact, number, place, or finding. Never vague.
- EXCLUSION — HARD RULE: Military operations, airstrikes, conflict developments, casualties, prisoner/hostage situations, and humanitarian crises (evacuations, famine, civilian deaths) must NEVER appear in Etcetera. These belong in InTheKnow under "Politics & World Affairs". Etcetera is for genuinely odd, surprising, or quirky stories — not for serious conflict news that happens to be left over.
- Each item: { "text": "...", "slug": "..." } — include the story's slug so we can link to it

GLOBAL BLINDSPOT (only if GLOBAL STORIES are provided):
- 1-sentence summary per global story explaining what's happening and why Americans should care
- Use the slug, region, AND title fields from the input exactly as-is — do NOT rewrite or invent a title
- "summary" must end with a concrete US relevance hook — connect to American wallets, security, rights, or foreign policy. Wrong: "a story Americans should follow." Right: "...a chokepoint that controls 20% of global oil supply, meaning price spikes at the pump could follow within weeks."

HOW THE WORLD SEES IT (only if INTERNATIONAL PERSPECTIVES are provided):
- For each NeedToKnow story, scan INTERNATIONAL PERSPECTIVES for stories about the same event, policy, or entity — including direct international reactions to a US policy (e.g. a Canadian or European outlet covering US tariffs, immigration policy, or court rulings counts as a match for those NeedToKnow stories).
- Add "howWorldSeesIt" if there is at least one clear topical match — same subject, same policy, or direct international reaction. You do not need an identical event; a reaction or perspective piece from abroad qualifies.
- TARGET: aim to include "howWorldSeesIt" on 2 NeedToKnow stories when matches exist. Do not force it if no reasonable match exists, but do not omit it just because the match is a reaction rather than identical coverage.
- If 1-3 matches exist, add a "howWorldSeesIt" array to that NeedToKnow item
- Each entry: { "region": "...", "slug": "...", "summary": "..." }
- "region" MUST be the specific outlet name from the input's "source" field (e.g. "Al Jazeera", "DW", "France 24", "TRT World", "ABC Australia") — NEVER a geographic label like "Middle East", "Europe", or "Australia". Extract the outlet name from the source field: "YouTube/DW News" → "DW News", "YouTube/Al Jazeera English" → "Al Jazeera".
- "summary" = one sentence describing how that outlet frames the story differently than the US angle
- If no DIRECT topical match exists, omit "howWorldSeesIt" entirely — do NOT add an empty array, do NOT force a connection, do NOT use thematic or tangential links (e.g. "both involve accountability" or "parallel power dynamics"). The match must be the same specific event, person, or policy — not a vague conceptual parallel.
- Never reuse a slug already used in globalBlindspots

GLOBAL LENS (only if INTERNATIONAL PERSPECTIVES are provided):
- Pick EXACTLY 3 international stories from INTERNATIONAL PERSPECTIVES that are NOT already in globalBlindspots and NOT already used in "howWorldSeesIt"
- These are international outlets covering stories that overlap with today's US news — showing how the same events look from abroad
- Each entry: { "region": "...", "slug": "...", "title": "...", "summary": "..." }
- Use the slug, region, and title fields from the input exactly as-is
- "region" MUST be the specific outlet name from the input's "source" field (e.g. "Al Jazeera", "DW", "France 24", "TRT World", "ABC Australia"). NEVER use a geographic label like "Europe", "Middle East", "Australia" — always use the outlet name. If the source is "YouTube/DW News", write "DW News". If "YouTube/Al Jazeera English", write "Al Jazeera".
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
    "Sports, Entertainment, & Culture": [{ "text": "...", "slug": "..." }],
    "Comedy & Satire": [{ "text": "...", "slug": "..." }]
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

  // First pass: remove any satire sources — these must never appear in NeedToKnow regardless of count
  const satireSlugs = new Set(
    freshCandidates
      .filter(s => SATIRE_HANDLES.has((s.journalist_username ?? '').toLowerCase()))
      .map(s => s.slug)
  )
  const satireItems = content.needToKnow.filter(i => satireSlugs.has(i.slug))
  for (const satireItem of satireItems) {
    const replacement = freshCandidates.find(s =>
      !satireSlugs.has(s.slug) &&
      !ntkSlugs.has(s.slug) &&
      (s.description?.length ?? 0) >= 80 &&
      !PROMO_TERMS.some(t => (s.description ?? '').toLowerCase().includes(t))
    )
    content.needToKnow = content.needToKnow.filter(i => i.slug !== satireItem.slug)
    if (replacement) {
      ntkSlugs.add(replacement.slug)
      content.needToKnow.push({
        sectionTitle: replacement.title.slice(0, 60),
        slug: replacement.slug,
        paragraphs: [replacement.description ?? ''],
      })
    }
    // If no replacement, drop to 2 NeedToKnow stories rather than insert garbage
  }

  // Second pass: cap total commentary at 1
  if (commentaryItems.length > MAX_COMMENTARY) {
    // Find best non-commentary candidate not already in NeedToKnow
    // Require a real story description (≥80 chars) — reject channel descriptions and promo text
    const replacement = freshCandidates.find(s =>
      getContentType(s) !== 'commentary' &&
      !ntkSlugs.has(s.slug) &&
      (s.description?.length ?? 0) >= 80 &&
      !PROMO_TERMS.some(t => (s.description ?? '').toLowerCase().includes(t))
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
    // If no suitable replacement exists, just drop down to 2 NeedToKnow stories rather than inserting garbage
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

  // Step 1: filter promo terms and Storyful-sourced stories from Claude's output
  // Storyful videos are always embed-blocked — no point surfacing them in the digest
  const storyfulSlugs = new Set(
    cappedStories.filter(s => (s.source ?? '').toLowerCase().includes('storyful')).map(s => s.slug)
  )
  content.etcetera = content.etcetera.filter(item => {
    const etc = typeof item === 'string' ? { text: item, slug: null } : item
    if (etc.slug && storyfulSlugs.has(etc.slug)) return false
    const text = (typeof item === 'string' ? item : item.text).toLowerCase()
    return !PROMO_TERMS.some(t => text.includes(t))
  })
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => !item.slug || !storyfulSlugs.has(item.slug))
  }

  // Step 2: deduplication — NeedToKnow and InTheKnow slugs take priority
  const usedSlugs = new Set<string>()
  for (const item of content.needToKnow) usedSlugs.add(item.slug)

  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => {
      if (!item.slug) return true
      if (usedSlugs.has(item.slug)) return false
      usedSlugs.add(item.slug)
      return true
    })
  }

  content.etcetera = content.etcetera.filter(item => {
    const etc = typeof item === 'string' ? { text: item, slug: null } : item
    // Drop slugless Etcetera items — Claude uses these for meta-commentary rather than real facts
    if (!etc.slug) return false
    if (usedSlugs.has(etc.slug)) return false
    usedSlugs.add(etc.slug)
    return true
  }) as EtceteraItem[]

  // Step 3: pad Etcetera AFTER deduplication and promo filtering so the count is accurate
  const MIN_ETCETERA = 3
  const ETCETERA_MIN_VIEWS = 1000  // don't pad with zero-traction stories

  // Truncate to last complete sentence within a character limit
  function toEtceteraText(desc: string, limit = 280): string {
    if (desc.length <= limit) return desc
    const truncated = desc.slice(0, limit)
    // Find last sentence boundary (. ! ?) before the limit
    const lastBoundary = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
    if (lastBoundary > 80) return truncated.slice(0, lastBoundary + 1).trim()
    // Fall back to last word boundary
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trim() + '…'
  }

  if (content.etcetera.length < MIN_ETCETERA) {
    for (const s of cappedStories) {
      if (content.etcetera.length >= MIN_ETCETERA) break
      if (usedSlugs.has(s.slug) || !s.description) continue
      if ((s.view_count ?? 0) < ETCETERA_MIN_VIEWS) continue
      if (PROMO_TERMS.some(t => s.description.toLowerCase().includes(t))) continue
      content.etcetera.push({ text: toEtceteraText(s.description), slug: s.slug })
      usedSlugs.add(s.slug)
    }
  }

  // Collect all slugs used in globalBlindspots, globalLens, and howWorldSeesIt so we can repair hallucinated titles
  const titledSlugs = new Set<string>()
  for (const item of content.globalBlindspots ?? []) titledSlugs.add(item.slug)
  for (const item of content.globalLens ?? []) titledSlugs.add(item.slug)
  for (const ntk of content.needToKnow) {
    for (const w of ntk.howWorldSeesIt ?? []) titledSlugs.add(w.slug)
  }

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

    // Fix globalLens — drop unknowns, restore real titles, cap at 3
    content.globalLens = (content.globalLens ?? []).filter(item => {
      if (!titleMap.has(item.slug)) return false
      if (!item.summary?.trim()) return false
      item.title = titleMap.get(item.slug)!
      return true
    }).slice(0, 3)

    // Populate howWorldSeesIt titles from DB
    for (const ntk of content.needToKnow) {
      if (!ntk.howWorldSeesIt) continue
      ntk.howWorldSeesIt = ntk.howWorldSeesIt.filter(w => {
        if (!titleMap.has(w.slug)) return false
        w.title = titleMap.get(w.slug)!
        return true
      })
      if (ntk.howWorldSeesIt.length === 0) delete ntk.howWorldSeesIt
    }
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
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const { data } = await supabase
    .from('digests')
    .select('*')
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single()
  return (data as Digest) ?? null
}
