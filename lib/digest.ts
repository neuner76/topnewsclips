import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getConfidenceLabel } from './confidence'

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

function sigWords(title: string): Set<string> {
  const stop = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','that','this','is','are','was','were','be','been','have',
    'has','had','will','after','during','its','as','over','into',
  ])
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
  )
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
      .select('id, title, slug, description, category, journalist_username, source, msm_gap, region, source_tier, source_type, msm_outlet_coverage, created_at, view_count')
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
    confidenceLabel: getConfidenceLabel(s as Parameters<typeof getConfidenceLabel>[0]),
    source_tier: s.source_tier ?? null,
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
- ONE STORY PER CARD — HARD RULE: Each NeedToKnow item must cover exactly one story. Do not bundle multiple unrelated developments into a single card even if they come from the same source or the same news cycle. If ABC News covers both a US blockade announcement AND JD Vance negotiations, those are two separate stories — write one card about the blockade, move the Vance item to InTheKnow. The word "Separately" in a NeedToKnow paragraph is a signal you have violated this rule. Test: write the sectionTitle first. If the summary requires "Separately" or "Also" or "Meanwhile" to cover the full card, split it.
- "sectionTitle": 3-5 word punchy label (e.g. "Trump Boots Noem", "Moon Beans", "China Growth Slowdown")
- "paragraphs": 2-4 full paragraphs expanding on ONE story — include key facts, numbers, context, and why it matters. Write like 1440 Daily Digest: smart, neutral, thorough. Never vague. The final paragraph must include a "Why this matters to you" sentence connecting the story to something tangible in an American's daily life — their wallet, their rights, their community, or their family. Make it specific and concrete, not generic. Wrong: "This could affect Americans." Right: "If you've driven past a license plate reader this week, your vehicle's location may already be in ICE's database." or "If you have a 401(k), the private equity fees documented here are likely embedded in funds you already own."
- TONE — REPORTER NOT ADVOCATE: Every sentence must describe what the source reports, shows, or claims. Use varied attribution language — do not repeat the same phrase more than once per paragraph. Attribution vocabulary: "reports that", "shows", "according to", "documents", "alleges", "found that", "the video shows", "the analysis finds", "per the report", "the investigation documents", "the explainer notes". FORBIDDEN phrases: "corrosive", "perverse", "troubling", "alarming", "shocking", "raises questions about", "sparks concerns", "drawing attention to", "highlights the need for", "underscores", "exposes" (use "documents" instead), any phrase that implies a conclusion the source didn't explicitly state. Wrong: "financial engineering at its most corrosive." Wrong: "raising questions about institutional transparency." Right: "Harris reports that the financing structure created incentives that, per the video, may prioritize revenue over care." Test every sentence: could a reader of any political affiliation find this sentence editorializing? If yes, rewrite it.

SUMMARY PADDING CHECK — MANDATORY FOR EVERY NEED TO KNOW ITEM:

After drafting each NeedToKnow item, apply this test:
STEP 1: List every confirmed fact. Count them.
STEP 2: List every sentence that is NOT a confirmed fact: speculation about future events, "it remains unclear whether...", "the committee has not announced...", "questions remain about...", characterizations of significance not attributed to a source, background context not from the current source.
STEP 3: If confirmed facts < non-fact sentences — the item is padded. Cut until facts dominate.

PADDING PHRASES — ELIMINATE these from the site's own voice:
  "It remains unclear whether..." → cut unless the uncertainty itself is the news
  "The committee has not announced a new date." → cut unless absence of date is significant
  "Questions remain about..." → cut entirely, it is filler
  "The implications of this development..." → cut unless source articulates and you attribute
  "This comes amid growing concerns about..." → cut, editorial throat-clearing
  "The move could signal..." → cut from site voice; only allowed as "The source argues the move could signal..."

PLACEMENT RULE: If after cutting padding a NeedToKnow item has fewer than 3 confirmed-fact sentences, move it to In The Know. NeedToKnow items earn their placement through depth of confirmed reporting, not padded prose.

REPORTED-LABEL VOICE CEILING — MANDATORY:

When the confidenceLabel is "REPORTED," the summary must stay within the boundaries of what the cited source actually reported:
1. Do NOT add contextual claims the source did not make. If ABC News did not say "international observers characterized the talks as historic," the summary may not say it.
2. Do NOT synthesize across sources under a Reported label. "Reported" = one credible source. If drawing from multiple sources, use Corroborated voice instead.
3. Do NOT upgrade language beyond the source's own characterization. If the source says "significant," do not write "historic" unless the source used that word.
4. Every factual claim must be traceable to the cited source. Test: could the reader watch/read the source and find every claim? If not, remove it or attribute it to a second source.
5. Background context is allowed but must be clearly marked — "ABC News reports X. [Context: Y]" — not blended into the reporting flow as if ABC said it.

VOICE CEILING BY CONFIDENCE LABEL (summary of all rules):
  CORROBORATED: State confirmed facts directly. Attribute interpretive claims.
  REPORTED: Stay within what the cited source reported. No synthesis. No upgraded language. Every claim traceable to source.
  DEVELOPING: Flag confirmed vs. emerging. Use uncertainty markers.
  SINGLE-SOURCE: Every sentence attributed. No site-voice conclusions.
  ANALYSIS: All claims framed as source's arguments. "The analysis argues..." required on every interpretive sentence.

EDITORIAL RESTRAINT RULES — MANDATORY FOR ALL PARAGRAPHS:

RULE 1 — MATCH VOICE TO CONFIDENCE:
Each story in the input has a "confidenceLabel" field. Apply these writing rules accordingly:
- CORROBORATED: You may state confirmed facts directly. Attribution still required for interpretive claims.
- REPORTED: Every claim must be attributed to the cited source. No synthesis beyond what that source stated.
- SINGLE-SOURCE: Every sentence must contain an attribution phrase. No sentence may read as the site's own conclusion.
- ANALYSIS: This is the strictest rule. EVERY sentence — including the first — must be framed as the source's argument, not a fact. Lead with "In an analysis, [source] argues..." or "[Source] characterizes this as..." You may not open with a declarative statement and then attribute later. The reader must know from the first word that this is one source's interpretation. If you cannot attribute every claim, cut it. Banned on Analysis items entirely (even inside attribution): "purge," "unprecedented," "consolidation of power," "sweeping," "signals" in site voice, "makes clear," "lays bare." These words imply settled conclusions — Analysis items have no settled conclusions.
- DEVELOPING: Note which details are confirmed and which are not. Use: "initial reports indicate," "details are still emerging," "accounts differ on."

RULE 1A — GENERAL CERTAINTY CALIBRATION:
After drafting every summary and InTheKnow bullet, read it back and ask: does this prose sound 10-15% more settled than the evidence warrants? Dense summaries — especially ones that pack multiple developments into a few sentences — tend to flatten uncertainty because each claim needs to connect to the next. This creates a false impression of coherence. The fix: after drafting, find the 1-2 most interpretive sentences and soften them by one register. "The talks represent the highest-level US-Iran engagement in decades" → "The talks are being described as the highest-level US-Iran engagement in decades, per multiple outlets." "Iran is struggling to locate its own mines" → "The source reports Iranian forces had difficulty locating mines they had deployed." The goal is not hedged prose — it is prose whose certainty level matches what the cited sources actually confirmed.

RULE 1B — ZERO-COVERAGE CERTAINTY FLOOR:
Each story has an "msmGap" field and the input coverage count is visible. When a story shows 0 of 15 outlets covered it AND it contains specific numerical claims (casualties, quantities, distances, prices), apply maximum skepticism in voice — even if confidenceLabel is "Reported":
- Do not present specific figures as confirmed facts. Write "X reports that" before every numerical claim.
- Do not narrate the event as settled. Use "according to the source," "per the report," "the source documents."
- The 0-of-15 count is visible to the reader. If your prose sounds more certain than 0 of 15 outlets suggests, the trust system breaks. Match your certainty to the coverage count.
- WRONG (0 of 15, Reported): "Trump announced 28 Iranian boats were destroyed. Iran struggled to locate its own mines."
- RIGHT (0 of 15, Reported): "The source reports Trump claimed 28 Iranian boats were destroyed. Per the same report, Iranian forces struggled to locate mines they had deployed."

RULE 2 — BANNED CONSTRUCTIONS ON THIN EVIDENCE:
On stories with confidenceLabel of SINGLE-SOURCE or ANALYSIS, do NOT use:
  "purge" or "purges" (use "removal" or "dismissal")
  "consolidation of control" (use "change in leadership")
  "unprecedented" without a specific historical comparison
  "sweeping" without defining the scope
  "dramatic shift" (use "change" or "departure")
  "signals" in the site's own voice (use "the source describes as")
  "underscores" in the site's own voice
  "raises critical questions" (use "the report raises questions" or describe what happened)

RULE 3 — FACTS FIRST, INTERPRETATION SECOND:
Structure every NeedToKnow paragraph sequence as:
  Paragraph 1: What happened. Plain facts. Attributed.
  Paragraph 2: What the source reports about context or significance. Clearly attributed as the source's framing.
Never lead with the interpretation and use facts as evidence for a conclusion already drawn.

RULE 4 — ONE STORY, ONE CLAIM:
Each NeedToKnow card must have a single, unmistakable center of gravity — one event, one actor, one development. If you catch yourself writing a card that touches a blockade AND a diplomatic summit AND a naval warning AND a counter-threat from a second country, you have four stories, not one. Pick the single most significant development and cut the rest. The other developments belong in InTheKnow as separate bullets — not packed into the same card.
  ANTI-PATTERN: "Israel has tightened its blockade on Gaza; separately, Pakistan and India held emergency talks in Islamabad; Iran's navy meanwhile warned ships near the Strait of Hormuz; Tehran also issued a counter-threat to..."
  CORRECT: One card = the blockade tightening. Islamabad talks = separate InTheKnow bullet. Hormuz warning = separate InTheKnow bullet.
  TEST: After writing a card, count the number of distinct actor–event pairs. If there are more than 2, cut to the strongest one.
  NO-BLEED RULE: If you have placed a sub-event from this card as its own InTheKnow bullet, do NOT also reference that sub-event in the card's paragraphs. One placement only. If the Vance/Islamabad talks are an InTheKnow bullet, the blockade card paragraphs must not mention them.

- Use the slug field from the input exactly as-is

IN THE KNOW:
- RECENCY: Stories have a "hoursAgo" field. Strongly prefer stories under 24 hours old. Only include older stories if they are genuinely significant and not already widely known.
- Remaining US stories as 1-sentence bullets under the correct topic category
- Each sentence should end with (More)
- LENGTH CEILING — HARD RULE: Each InTheKnow bullet is ONE sentence, maximum 45 words. If you cannot state the core fact in 45 words, you are compressing too many stories into one bullet — pick the single most important fact and cut the rest. Do not write mini-essays. Do not chain multiple developments with semicolons or "and separately." One bullet = one fact.
- ONE STORY PER BULLET: Do not bundle multiple unrelated developments into one InTheKnow bullet. "CNN reports Trump said X, while separately Pakistan and Hezbollah and Iran's parliament speaker all did Y" is three bullets, not one.
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
  * "Sports, Entertainment, & Culture": ONLY sports scores/games/athletes, celebrity news, film, TV, music, arts — NOT law enforcement, military, or politics. If unsure, default to "Politics & World Affairs". QUALITY BAR: personal relationship drama, memoir backlash, and social media pile-ons do not meet the bar — skip them entirely rather than forcing them into this category. EPSTEIN RULE — HARD: Any story involving Jeffrey Epstein, his associates, sex trafficking, or related legal proceedings belongs in "Politics & World Affairs" regardless of whether celebrities are involved. "Melania and Epstein" is Politics, not Sports/Entertainment. "Trump and Epstein" is Politics. Any story where the news hook is institutional conduct, legal proceedings, or abuse of power — even if the subject is a celebrity — belongs in Politics.
  * "Comedy & Satire": MANDATORY for The Daily Show (@thedailyshow), Last Week Tonight (@lastweektonight), Jonathan Pie (@jonathanpie), Some More News (@smn), Josh Johnson (@joshjohnsoncomedy), The Juice Media (@thejuicemedia) — regardless of topic. These sources MUST go here, never in Politics & World Affairs. Do NOT place serious political commentary, opinion journalism, or investigative analysis here — Glenn Greenwald, Breaking Points, Caspian Report, and similar channels belong in "Politics & World Affairs" or "Business & Markets" based on topic.

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
- 1-sentence summary per global story
- Use the slug, region, AND title fields from the input exactly as-is — do NOT rewrite or invent a title
- Only include stories with coverage count ≤ 2 of 14 US outlets (these are the genuine blindspots)
- US RELEVANCE GATE — MANDATORY: Before adding a "why this matters to Americans" frame, apply this test:

  INCLUDE US RELEVANCE FRAME only when the connection is DIRECT AND CONCRETE:
    ✓ US gas prices will be affected (e.g. Strait of Hormuz, OPEC decisions)
    ✓ US military personnel are deployed or at risk
    ✓ US taxpayer dollars fund the program or aid involved
    ✓ US citizens' rights are affected (travel, trade, detention abroad)
    ✓ US imports/exports are directly disrupted
    ✓ A US company or institution is named in the story
    ✓ A US law, court ruling, or policy is directly referenced
  Format: one factual sentence — "This matters to Americans because US military aid to Israel exceeds $3 billion annually."

  OMIT US RELEVANCE FRAME when the connection is vague or requires inferential leaps:
    ✗ "raises questions for US policymakers"
    ✗ "could have implications for American interests"
    ✗ "matters to Americans tracking global trends"
    ✗ "relevant as the US debates similar issues"
    ✗ "offers lessons for American educators/businesses/leaders"
    ✗ "potential consequences for regional security" (too vague)
    ✗ "US-[country] competition for influence" (geopolitical framing, not a direct impact)
    ✗ "connects to broader US foreign policy debates"
    ✗ "a development US officials will be watching"
  When the connection is weak, simply present the story as significant international news. The Global Blindspot section already justifies inclusion: "the rest of the world is covering this and US media is not." That is sufficient — no additional US hook required.

  BLINDSPOT TONE: Write as a calm, informed observer — not as a product arguing for why it included a story. The worst Blindspot summaries sound like they are making a case for inclusion. The best ones simply report what happened and let the significance speak for itself. Test every sentence: is this sentence here to inform the reader, or to justify the item's presence on the page? If it's the latter, cut it.

  TREND-SYNTHESIS FILTER — HARD RULE: Global Blindspot is for news events, not trend analysis. Reject any item whose summary is primarily about what "could," "may," "might," or "is expected to" happen — or that synthesizes a multi-year trajectory rather than reporting a specific event. The story must have a dateable event: a vote, a ruling, a launch, an arrest, a report publication, a statement by a named official. Future-facing synthesis ("nations are accelerating toward X," "experts warn this technology could reshape Y within a decade," "a growing movement is challenging Z") belongs in a weekly analysis piece, not a daily news blindspot.
  ANTI-PATTERN: "Several nations are expanding lunar mining programs that could challenge US dominance in space resources within the next decade, analysts say."
  CORRECT: "Japan's JAXA signed an agreement with [country] to begin exploratory lunar drilling missions in [year]." (specific, dateable, attributable)

  WRONG: "India's ruling carries implications for how American courts may weigh similar arguments."
  RIGHT: "India's Supreme Court ruled Parliament, not the judiciary, should expand marriage rights — drawing dissent from the Chief Justice." (stop there — no forced US frame)

  WRONG: "a development that matters to Americans because US policymakers may take note."
  RIGHT: "...a chokepoint controlling 20% of global oil supply, meaning price spikes at the pump could follow within weeks." (only if that connection is real)

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
- "summary" = one sentence describing how this outlet frames the story differently — keep it observational, not assertive. Describe the framing difference as a fact ("Al Jazeera leads with X rather than Y") not as a significance claim ("this is crucial context Americans need"). The reader decides what is significant.
- If fewer than 3 unused international stories exist, omit "globalLens" entirely
- Never reuse a slug already used in globalBlindspots or howWorldSeesIt

HOMEPAGE STORY MIX — HARD RULE (apply BEFORE finalizing):

No single conflict, topic, or story cluster may account for more than 50% of total homepage items. Count all items across: Need To Know, In The Know, Global Blindspot, Global Lens, and Etcetera.

If one topic (e.g., Iran/Middle East conflict, US-Iran talks) exceeds 50% of total items:
1. Identify the strongest non-conflict stories available in the input that were not initially selected.
2. Replace the weakest items from the dominant cluster with them. "Weakest" = lowest confidence, lowest source tier, most duplicative of another item already on the page.

SECTION-SPECIFIC LIMITS:
- Need To Know: maximum 2 items from the same story cluster. At least 1 must be a different topic.
- In The Know: at least 2 category sections must be non-conflict. Science & Technology, Business & Markets, Sports/Entertainment/Culture, or Comedy & Satire all qualify as non-conflict.
- Global Blindspot: maximum 3 items from the same region or conflict. At least 1 must be from a different region or topic.
- Global Lens: no clustering limit — this section is specifically about multiple outlets covering the same story.
- Etcetera: ZERO items from the dominant conflict cluster. This section exists for breadth and variety.

EXCEPTION: Suspend the 50% rule ONLY if the event would lead every major outlet worldwide simultaneously AND no reasonable reader would expect topic diversity that day (nuclear strike, 9/11-scale event). Active wars and ongoing diplomatic negotiations do NOT qualify for suspension — they are important but not singular.

DAILY SELF-CHECK before finalizing:
  ✓ Count total items. Dominant topic ≤ 50%?
  ✓ Need To Know has ≤ 2 from same cluster?
  ✓ In The Know has ≥ 2 non-conflict categories?
  ✓ Global Blindspot has ≥ 1 non-conflict item?
  ✓ Etcetera has 0 items from dominant cluster?

HOMEPAGE INCLUSION GATE — HARD RULES (apply BEFORE finalizing each section):

NEED TO KNOW:
  - MUST be Tier 1-6 sources only (source_tier ≤ 6 in the input)
  - MUST have contentType "footage", "investigation", or "report" — not "commentary"
  - Tier 7 commentary ONLY if: the underlying event is confirmed by a Tier 1-5 source AND no Tier 1-5 source covers the same event
  - NEVER satire sources

IN THE KNOW:
  - Tier 1-6 reported/investigative/footage: included by default
  - COMMENTARY CEILING: Maximum 1 commentary item per category section. Commentary includes: opinion journalism, creator analysis, pundit explainers, niche deep-dives from advocacy-adjacent outlets. If a category has 3+ items and more than 1 is commentary, drop the weakest commentary item. Reported facts beat commentary when covering the same event.
  - Tier 7 commentary: only if the underlying event is independently confirmed by at least one Tier 1-5 source — if confirmed, prefer the Tier 1-5 source as the primary item and use the commentary as supplemental context
  - Raw footage (contentType="footage"): maximum 1 item in In The Know per day
  - Apply source_tier from the input data to determine tier

GLOBAL BLINDSPOT:
  - Prefer Tier 1-3 sources (public broadcasters, wire services, nonprofit newsrooms)
  - Tier 7 only if no Tier 1-5 source covers the same story

GLOBAL LENS:
  - Prefer Tier 3 public broadcaster sources
  - Each item must present a meaningfully DIFFERENT framing from US coverage — not just the same facts from a different outlet
  - Maximum 4 items

ETCETERA:
  - Genuinely lighter, miscellaneous, or quirky items only — maximum 3
  - Any story with direct military, humanitarian, or policy significance must be promoted to Politics & World Affairs instead

DAILY SELF-CHECK — before finalizing output verify:
  ✓ Every Need To Know item has source_tier ≤ 6 in the input
  ✓ No satire in Need To Know
  ✓ Maximum 1 satire item on entire homepage
  ✓ Maximum 1 raw footage item in In The Know
  ✓ Every Tier 7 item in In The Know has the underlying event confirmed by a Tier 1-5 source
  ✓ Etcetera has maximum 3 items, none with military/humanitarian significance

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

  // Homepage gate: NeedToKnow must not contain pure analysis/commentary — evict any that slipped through
  // This applies regardless of tier: even a Tier 4 source publishing analysis shouldn't be in NeedToKnow
  // unless no non-commentary replacement exists. Exception: allow max 1 commentary if no non-commentary available.
  const ntkCommentarySlugs = new Set(
    freshCandidates
      .filter(s => getContentType(s) === 'commentary')
      .map(s => s.slug)
  )
  const ntkCommentaryViolations = content.needToKnow.filter(i => ntkCommentarySlugs.has(i.slug))
  for (const violation of ntkCommentaryViolations) {
    const currentNtkSlugs = new Set(content.needToKnow.map(i => i.slug))
    const replacement = freshCandidates.find(s =>
      getContentType(s) !== 'commentary' &&
      !currentNtkSlugs.has(s.slug) &&
      (s.description?.length ?? 0) >= 80 &&
      !PROMO_TERMS.some(t => (s.description ?? '').toLowerCase().includes(t))
    )
    if (replacement) {
      content.needToKnow = content.needToKnow.filter(i => i.slug !== violation.slug)
      content.needToKnow.push({
        sectionTitle: replacement.title.slice(0, 60),
        slug: replacement.slug,
        paragraphs: [replacement.description ?? ''],
      })
    }
    // If no non-commentary replacement exists, leave the commentary item rather than drop below 2
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

  // Homepage satire gate — enforce: max 1 satire item total, satire ONLY in Comedy & Satire section
  // Move any satire that leaked into other InTheKnow categories into Comedy & Satire
  const satireSlugsSet = new Set(
    cappedStories
      .filter(s => SATIRE_HANDLES.has((s.journalist_username ?? '').toLowerCase()))
      .map(s => s.slug)
  )

  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    if (cat === 'Comedy & Satire') continue
    const leaked = content.inTheKnow[cat].filter(item => item.slug && satireSlugsSet.has(item.slug))
    if (leaked.length > 0) {
      content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => !item.slug || !satireSlugsSet.has(item.slug))
      content.inTheKnow['Comedy & Satire'].push(...leaked)
    }
  }

  // Cap Comedy & Satire at 1 item — keep the one with the highest view count among source stories
  if (content.inTheKnow['Comedy & Satire'].length > 1) {
    const ranked = content.inTheKnow['Comedy & Satire']
      .map(item => ({ item, views: cappedStories.find(s => s.slug === item.slug)?.view_count ?? 0 }))
      .sort((a, b) => b.views - a.views)
    content.inTheKnow['Comedy & Satire'] = [ranked[0].item]
  }

  // Tier 10 gate — remove Community Sourced (Tier 10) items from InTheKnow unless independently verified (3+ outlets)
  const tier10Slugs = new Set(
    cappedStories
      .filter(s => (s.source_tier ?? 99) >= 10)
      .filter(s => {
        const covered = s.msm_outlet_coverage?.covered?.length ?? 0
        return covered < 3  // allow Tier 10 only if 3+ outlets confirm the underlying story
      })
      .map(s => s.slug)
  )
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => !item.slug || !tier10Slugs.has(item.slug))
  }

  // InTheKnow commentary ceiling — max 1 commentary/analysis item per category section
  // Keeps the highest-credibility commentary (lowest source_tier), drops the rest
  const storyTierMap = new Map(cappedStories.map(s => [s.slug, s.source_tier ?? 99]))
  const storyContentTypeMap = new Map(cappedStories.map(s => [s.slug, getContentType(s)]))
  const COMMENTARY_TYPES = new Set(['commentary'])
  const COMMENTARY_CATEGORIES = new Set(['analysis'])
  const isCommentaryItem = (slug: string | null): boolean => {
    if (!slug) return false
    const ct = storyContentTypeMap.get(slug)
    if (ct && COMMENTARY_TYPES.has(ct)) return true
    const story = cappedStories.find(s => s.slug === slug)
    if (story?.category && COMMENTARY_CATEGORIES.has(story.category)) return true
    return false
  }
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    if (cat === 'Comedy & Satire') continue  // satire gate handles this category separately
    const items = content.inTheKnow[cat]
    const commentaryItems = items.filter(item => isCommentaryItem(item.slug))
    if (commentaryItems.length <= 1) continue
    // Keep the commentary item with the best (lowest) source tier; drop the rest
    commentaryItems.sort((a, b) => (storyTierMap.get(a.slug ?? '') ?? 99) - (storyTierMap.get(b.slug ?? '') ?? 99))
    const keepSlug = commentaryItems[0].slug
    const dropSlugs = new Set(commentaryItems.slice(1).map(i => i.slug).filter(Boolean))
    content.inTheKnow[cat] = items.filter(item => !item.slug || !dropSlugs.has(item.slug))
  }

  // InTheKnow commentary-on-NeedToKnow-topic eviction
  // Drop commentary/analysis InTheKnow items whose topic already appears in NeedToKnow
  // Prevents pundit takes on a story that's already covered by a primary NeedToKnow card
  const ntkTopicWordsEarly = new Set<string>()
  for (const ntk of content.needToKnow) {
    const story = cappedStories.find(s => s.slug === ntk.slug)
    if (story) for (const w of sigWords(story.title)) ntkTopicWordsEarly.add(w)
    // Also index the sectionTitle words so topic overlap catches renamed cards
    for (const w of sigWords(ntk.sectionTitle)) ntkTopicWordsEarly.add(w)
  }
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    if (cat === 'Comedy & Satire') continue
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => {
      if (!item.slug) return true
      if (!isCommentaryItem(item.slug)) return true  // only evict commentary/analysis, not reported items
      const story = cappedStories.find(s => s.slug === item.slug)
      if (!story) return true
      let overlap = 0
      for (const w of sigWords(story.title)) if (ntkTopicWordsEarly.has(w)) overlap++
      return overlap < 2  // drop if 2+ topic words overlap with any NeedToKnow card
    })
  }

  // Step 1: filter promo terms, Storyful-sourced stories, and analysis/commentary from Etcetera
  // Storyful videos are always embed-blocked — no point surfacing them in the digest
  // Analysis and commentary items don't belong in Etcetera — they belong in InTheKnow
  const storyfulSlugs = new Set(
    cappedStories.filter(s => (s.source ?? '').toLowerCase().includes('storyful')).map(s => s.slug)
  )
  // Etcetera must exclude: analysis, commentary, AND raw footage on serious topics (conflict, policy, disasters)
  const ETCETERA_SERIOUS_KEYWORDS = [
    'flood', 'hurricane', 'tornado', 'earthquake', 'wildfire', 'drought',
    'shooting', 'killed', 'dead', 'deaths', 'injured', 'crash', 'explosion',
    'war', 'strike', 'missile', 'bomb', 'attack', 'conflict', 'military',
    'iran', 'israel', 'ukraine', 'russia', 'china', 'north korea',
    'congress', 'senate', 'court', 'supreme', 'indicted', 'arrested', 'charged',
    'data center', 'megawatt', 'vote', 'council', 'board', 'approved',
  ]
  const analysisCommentarySlugs = new Set(
    cappedStories
      .filter(s => {
        if (s.category === 'analysis' || getContentType(s) === 'commentary') return true
        // Also block raw footage on serious topics from Etcetera
        const titleLower = (s.title ?? '').toLowerCase()
        const descLower = (s.description ?? '').toLowerCase()
        if (ETCETERA_SERIOUS_KEYWORDS.some(k => titleLower.includes(k) || descLower.slice(0, 100).includes(k))) return true
        return false
      })
      .map(s => s.slug)
  )
  content.etcetera = content.etcetera.filter(item => {
    const etc = typeof item === 'string' ? { text: item, slug: null } : item
    if (etc.slug && storyfulSlugs.has(etc.slug)) return false
    if (etc.slug && analysisCommentarySlugs.has(etc.slug)) return false
    const text = (typeof item === 'string' ? item : item.text).toLowerCase()
    return !PROMO_TERMS.some(t => text.includes(t))
  })
  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].filter(item => !item.slug || !storyfulSlugs.has(item.slug))
  }

  // Truncate to last complete sentence within a character limit
  function toEtceteraText(desc: string, limit = 280): string {
    if (desc.length <= limit) return desc
    const truncated = desc.slice(0, limit)
    const lastBoundary = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
    if (lastBoundary > 80) return truncated.slice(0, lastBoundary + 1).trim()
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trim() + '…'
  }

  // Truncate InTheKnow bullets to ~55 words — enforce the one-fact-per-bullet discipline
  function trimItkBullet(text: string, wordLimit = 55): string {
    const words = text.split(/\s+/)
    if (words.length <= wordLimit) return text
    // Find last sentence boundary within word limit
    const candidate = words.slice(0, wordLimit).join(' ')
    const lastBoundary = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '))
    if (lastBoundary > 30) return candidate.slice(0, lastBoundary + 1).trim()
    return candidate.trim() + '…'
  }

  for (const cat of Object.keys(content.inTheKnow) as Array<keyof typeof content.inTheKnow>) {
    content.inTheKnow[cat] = content.inTheKnow[cat].map(item => ({
      ...item,
      text: trimItkBullet(item.text),
    }))
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

  // Build a topic word set from NeedToKnow titles for topic-level deduplication
  const ntkTopicWords = new Set<string>()
  for (const ntk of content.needToKnow) {
    const story = cappedStories.find(s => s.slug === ntk.slug)
    if (story) for (const w of sigWords(story.title)) ntkTopicWords.add(w)
  }

  content.etcetera = (content.etcetera.filter(item => {
    const etc = typeof item === 'string' ? { text: item, slug: null } : item
    // Drop slugless Etcetera items — Claude uses these for meta-commentary rather than real facts
    if (!etc.slug) return false
    if (usedSlugs.has(etc.slug)) return false
    // Text-based serious-topic check — catches items whose generated text has serious keywords
    // even if the slug lookup didn't catch them in step 1
    const generatedText = etc.text.toLowerCase()
    if (ETCETERA_SERIOUS_KEYWORDS.some(k => generatedText.includes(k))) return false
    // Also drop analysis/commentary items that slipped past step 1 (e.g. null slug at that point)
    if (isCommentaryItem(etc.slug)) return false
    const slugStory = cappedStories.find(s => s.slug === etc.slug)
    if (slugStory?.category === 'analysis') return false
    // Drop Etcetera items whose topic overlaps significantly with a NeedToKnow story
    const story = slugStory
    if (story) {
      let overlap = 0
      for (const w of sigWords(story.title)) if (ntkTopicWords.has(w)) overlap++
      if (overlap >= 2) return false  // same topic already in NeedToKnow
    }
    usedSlugs.add(etc.slug)
    return true
  }) as EtceteraItem[]).map(item => ({
    ...item,
    // Truncate Claude-generated text to last complete sentence within 240 chars
    text: toEtceteraText(item.text, 240),
  }))

  // Step 3: pad Etcetera AFTER deduplication and promo filtering so the count is accurate
  const MIN_ETCETERA = 3
  const ETCETERA_MIN_VIEWS = 1000  // don't pad with zero-traction stories

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
    // Also drop trend-synthesis items: these are forward-looking analysis pieces, not news events
    const TREND_SYNTHESIS_PHRASES = [
      'within the next decade', 'over the next decade', 'in the coming decade',
      'accelerate toward', 'accelerating toward', 'on track to',
      'could reshape', 'could transform', 'could redefine', 'could disrupt',
      'may reshape', 'may transform', 'may redefine',
      'expected to reach', 'projected to', 'set to become',
      'growing movement', 'a new era of', 'marks a turning point',
      'analysts say', 'experts warn', 'experts say',
    ]
    const isTrendSynthesis = (summary: string): boolean => {
      const lower = summary.toLowerCase()
      return TREND_SYNTHESIS_PHRASES.some(p => lower.includes(p))
    }
    content.globalBlindspots = (content.globalBlindspots ?? []).filter(item => {
      if (!titleMap.has(item.slug)) return false
      if (!item.summary?.trim()) return false
      if (isTrendSynthesis(item.summary)) return false  // reject future-facing trend analysis
      item.title = titleMap.get(item.slug)!
      return true
    })

    // Fix globalLens — drop unknowns, restore real titles, deduplicate by outlet, cap at 4
    const seenLensOutlets = new Set<string>()
    content.globalLens = (content.globalLens ?? []).filter(item => {
      if (!titleMap.has(item.slug)) return false
      if (!item.summary?.trim()) return false
      if (seenLensOutlets.has(item.region)) return false  // one item per outlet
      seenLensOutlets.add(item.region)
      item.title = titleMap.get(item.slug)!
      return true
    }).slice(0, 4)

    // Populate howWorldSeesIt titles from DB and deduplicate by outlet (region field)
    for (const ntk of content.needToKnow) {
      if (!ntk.howWorldSeesIt) continue
      const seenOutlets = new Set<string>()
      ntk.howWorldSeesIt = ntk.howWorldSeesIt.filter(w => {
        if (!titleMap.has(w.slug)) return false
        if (seenOutlets.has(w.region)) return false  // drop duplicate outlet
        seenOutlets.add(w.region)
        w.title = titleMap.get(w.slug)!
        return true
      })
      if (ntk.howWorldSeesIt.length === 0) delete ntk.howWorldSeesIt
    }
  }

  // Etcetera significance filter — promote or drop items that are too important for this shelf
  // Items about elections, government transitions, war outcomes, or major policy belong in InTheKnow
  const ETCETERA_TOO_SIGNIFICANT = [
    'election', 'elected', 'wins supermajority', 'ousts', 'parliament', 'prime minister', 'president',
    'orban', 'orbán', 'magyar', 'blockade', 'ceasefire', 'war', 'killed', 'nuclear',
    'nato', 'supreme court', 'indicted', 'convicted', 'sentenced',
  ]
  content.etcetera = content.etcetera.filter(item => {
    const t = item.text.toLowerCase()
    return !ETCETERA_TOO_SIGNIFICANT.some(k => t.includes(k))
  })

  // Cap Etcetera at 3 (homepage gate hard rule — applied after padding so minimum is still met first)
  content.etcetera = content.etcetera.slice(0, 3)

  // Cap Global Lens at 4 (homepage gate)
  if (content.globalLens) content.globalLens = content.globalLens.slice(0, 4)

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
