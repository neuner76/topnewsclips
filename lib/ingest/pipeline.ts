import { createClient } from '@supabase/supabase-js'
import { fetchYouTubeTrending, resolveYouTubeChannelId, type YouTubeClip } from './youtube'
import { fetchTikTokTrending, type TikTokClip } from './tiktok'
import { fetchGlobalClips, type GlobalClip } from './global'
import { checkMSMCoverage } from './msm-check'
import { verifyAndTitle } from './claude-verify'
import { classifyStory } from './classify'
import { reconcileRegion } from './geo'
import { pingIndexNow } from './indexnow'
import { getSourceTier } from './source-tier'
import { runQCAndInsert } from './qc-publish'
import { runSectionQC } from './section-qc'
import { isSatireSource } from '../satire-sources'
import { summarizeLight } from './summarize-light'
import { getConfidenceLabel, CONFIDENCE_META } from '@/lib/confidence'
import type { QCConfidenceLabel } from './qc-gate'
import { tagStoryBySlug } from '@/lib/story-taxonomy'

export interface PipelineResult {
  inserted: number
  needsReview: number
  rejected: number
  held: number
  errors: string[]
  stories: Array<{ title: string; slug: string; decision: string }>
}

export interface FetchResult {
  added: number
  errors: string[]
}

// Strips unpaired Unicode surrogates that can break JSON serialization
// over the Supabase REST API (e.g. malformed emoji in YouTube metadata).
function sanitize(s: string): string {
  return s.replace(/[\uD800-\uDFFF]/g, '')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function makeSlug(platform: string, id: string | null, title: string): string {
  if (id) return `${platform}-${id}`
  return `${platform}-${slugify(title)}`
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Rejection reasons that are about coverage/diversity at this moment, not the
// content itself — the story may legitimately re-enter once it gets more
// pickup, so these expire after 24h. Everything else (junk, embed-blocked,
// content-based Claude rejections) is permanent (expires_at: null).
const TTL_REJECTION_PATTERNS = [
  /coverage/i,
  /mainstream media articles?/i,
  /\bmsm\b/i,
  /topic_cap/i,
  /channel_cap/i,
  /fewer than \d+/i,
]

const REJECTION_TTL_MS = 24 * 60 * 60 * 1000

function rejectionExpiresAt(reason: string): string | null {
  if (TTL_REJECTION_PATTERNS.some(p => p.test(reason))) {
    return new Date(Date.now() + REJECTION_TTL_MS).toISOString()
  }
  return null
}

async function upsertRejection(supabase: ReturnType<typeof getSupabase>, slug: string, reason: string) {
  await supabase.from('rejected_slugs').upsert({ slug, reason, expires_at: rejectionExpiresAt(reason) })
}

// Returns false if YouTube has blocked this video from third-party embedding
async function isYouTubeEmbeddable(videoUrl: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    )
    // 401 = embedding disabled, 403 = blocked by rights holder, 404 = not found
    return res.ok
  } catch {
    return true // assume embeddable on timeout/network error — don't block on uncertainty
  }
}

// Returns the significant words from a title (strips stop words and short tokens)
function sigWords(title: string): Set<string> {
  const stop = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','that','this','is','are','was','were','be','been','have',
    'has','had','will','after','during','its','as','after','outside','near',
    'into','over','three','four','five','two','six','seven','eight','nine',
  ])
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
  )
}

// True if two titles share enough words to likely be the same incident
function isSameIncident(a: string, b: string, threshold = 3): boolean {
  const wa = sigWords(a)
  const wb = sigWords(b)
  let overlap = 0
  for (const w of wa) if (wb.has(w)) overlap++
  return overlap >= threshold
}

export function isSoftAnimalStory(title: string, description = ''): boolean {
  const text = `${title} ${description}`.toLowerCase()
  const animalPattern = /\b(hawk|bird|eagle|owl|dog|cat|kitten|puppy|horse|cow|goat|deer|bear|wildlife|pet|zoo|farm animal)\b/
  const softRescuePattern = /\b(rescue|rescues|rescued|saving|saved|injured|nursed back|rehab|regaining strength|scary)\b/
  const publicInterestPattern = /\b(policy|investigation|lawsuit|charges|arrest|police|public health|disease|outbreak|endangered species act|animal cruelty)\b/

  return animalPattern.test(text) && softRescuePattern.test(text) && !publicInterestPattern.test(text)
}

const JOURNALIST_DAILY_CAP = 3

// Satire/comedy handles — exempt from the daily journalist cap (gated to Comedy &
// Satire, so the cap was silently dropping newer episodes) and given a longer
// freshness window (A3) to account for weekly show cadence.
// A3: freshness gate — reject candidates whose upload date is older than this
// window. Trending surfaces can resurface old documentaries/retrospectives
// alongside same-day news; satire shows get a longer window for weekly cadence.
const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const SATIRE_FRESHNESS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

function isSatireCandidate(c: { journalistUsername?: string | null; source?: string | null }): boolean {
  return isSatireSource(c.journalistUsername, c.source)
}

// True if the candidate is too old to run alongside same-day news. Candidates
// without a known upload date (TikTok/Global, which don't expose one) pass
// through unfiltered — we can't penalize what we can't measure.
export function isFresh(c: { uploadedAt?: string | null; journalistUsername?: string | null; source?: string | null }): boolean {
  if (!c.uploadedAt) return true
  const age = Date.now() - new Date(c.uploadedAt).getTime()
  const window = isSatireCandidate(c) ? SATIRE_FRESHNESS_WINDOW_MS : FRESHNESS_WINDOW_MS
  return age <= window
}

// Trust gate: the lowest-credibility tiers (8-10, plus unrecognized sources,
// which default to lower credibility until reviewed) must not auto-publish
// with zero independent outlet coverage. The Single-source label discloses
// the gap but is not corroboration — these route to review instead.
export function needsCorroborationHold(tier: number | null, coverageCount: number): boolean {
  return (tier === null || tier >= 8) && coverageCount === 0
}

// Keep only the highest-viral-score version when multiple candidates cover the same incident
function deduplicateByTitle<T extends { title: string; viralScore: number }>(candidates: T[]): T[] {
  const result: T[] = []
  for (const c of candidates) {
    const idx = result.findIndex(r => isSameIncident(r.title, c.title))
    if (idx === -1) {
      result.push(c)
    } else if (c.viralScore > result[idx].viralScore) {
      result[idx] = c
    }
  }
  return result
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Phase 1: fetch all sources and queue new candidates into the candidates table
export async function runFetch(): Promise<FetchResult> {
  const supabase = getSupabase()
  const youtubeKey = process.env.YOUTUBE_API_KEY
  const apifyKey = process.env.APIFY_API_KEY
  const errors: string[] = []
  let added = 0

  // Fetch active journalist usernames per platform
  const [{ data: tiktokJournalistRows }, { data: youtubeJournalistRows }] = await Promise.all([
    supabase.from('featured_journalists').select('username').eq('active', true).eq('platform', 'tiktok'),
    supabase.from('featured_journalists').select('username, channel_id').eq('active', true).eq('platform', 'youtube'),
  ])
  const journalistUsernames = (tiktokJournalistRows ?? []).map((r: { username: string }) => r.username)

  // Resolve any YouTube journalist channel IDs not yet cached in the DB
  const youtubeJournalists: { username: string; channelId: string }[] = []
  for (const row of (youtubeJournalistRows ?? []) as { username: string; channel_id: string | null }[]) {
    let channelId = row.channel_id
    if (!channelId && youtubeKey) {
      channelId = await resolveYouTubeChannelId(row.username, youtubeKey)
      if (channelId) {
        await supabase
          .from('featured_journalists')
          .update({ channel_id: channelId })
          .eq('platform', 'youtube')
          .eq('username', row.username)
      }
    }
    if (channelId) youtubeJournalists.push({ username: row.username, channelId })
  }

  const [youtubeResult, tiktokResult, globalResult] = await Promise.all([
    youtubeKey
      ? fetchYouTubeTrending(youtubeKey, youtubeJournalists)
      : Promise.resolve({ clips: [], errors: ['YOUTUBE_API_KEY not set'], staleChannels: [] }),
    apifyKey
      ? fetchTikTokTrending(apifyKey, journalistUsernames)
      : Promise.resolve({ clips: [], errors: [] }),
    fetchGlobalClips(youtubeKey),
  ])

  errors.push(...youtubeResult.errors, ...tiktokResult.errors, ...globalResult.errors)

  // Clear stale channel_ids so they get re-resolved on the next run
  if (youtubeResult.staleChannels.length > 0) {
    await Promise.all(youtubeResult.staleChannels.map(username =>
      supabase.from('featured_journalists').update({ channel_id: null }).eq('platform', 'youtube').eq('username', username)
    ))
    errors.push(`Cleared stale channel_ids for: ${youtubeResult.staleChannels.join(', ')}`)
  }

  const candidates = [
    ...youtubeResult.clips.map((c: YouTubeClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: 'youtube',
      videoId: c.videoId,
      description: c.description,
      viralScore: c.viewCount,
      source: `YouTube/${c.channelTitle}`,
      journalistUsername: c.journalistUsername ?? null,
      duration: c.duration ?? null,
      uploadedAt: c.publishedAt || null,
    })),
    ...tiktokResult.clips.map((c: TikTokClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: 'tiktok',
      videoId: c.videoId,
      description: c.description,
      viralScore: c.viewCount,
      source: `TikTok/@${c.authorName}`,
      thumbnailUrl: c.thumbnailUrl ?? null,
      journalistUsername: c.journalistUsername ?? null,
    })),
    ...globalResult.clips.map((c: GlobalClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: c.platform as string,
      videoId: c.videoId,
      description: c.description,
      viralScore: c.score,
      source: c.source,
      region: c.region,
    })),
  ]

  if (candidates.length === 0) {
    errors.push('No candidates fetched from any source')
    return { added, errors }
  }

  // Block sources that always produce embed-blocked videos — no point queuing them
  // Match on source string containing "storyful" (case-insensitive) to catch all Storyful channel variants
  const GAMING_TERMS = ['gta', 'grand theft auto', 'minecraft', 'roblox', 'fortnite', 'call of duty', 'gameplay', "let's play", 'video game', 'gaming', 'twitch stream', 'esport']
  const NOISE_TERMS = [
    '#scary', 'skinwalker', '#paranormal', '#horror', '#learnontiktok', '#scienceexperiments',
    'science activity for kids', 'fun science activity', 'bumblebee edition', 'underwater test',
    'dirty soda', 'panini sticker', 'heart-shaped skid marks', '#fyp', '#viral',
    'good samaritan', 'helps disabled', 'helps homeless', 'disabled person',
  ]
  const SOFT_NEWS_PATTERNS = [
    /\bworld cup\b.*\b(arrive|arrival|prediction|predictions|winner|sticker|panini)\b/i,
    /\b(arrive|arrival)\b.*\bworld cup\b/i,
    /\bfootball\b.*\bsoccer\b/i,
    /\biphone\b.*\bgalaxy\b/i,
    /\bpopemobile\b|\bgreets faithful\b/i,
    /\b(scariest|craziest|best|top)\b.*\b(caught on camera|caught on video)\b/i,
    /\b(tsunamis?|tornadoes|storms|accidents)\b.*\b(caught on camera|caught on video)\b/i,
    /\b(ai-powered robots?|ethical hacker|dirty sodas?)\b/i,
  ]
  const filteredCandidates = candidates.filter(c => {
    const username = ((c as { journalistUsername?: string | null }).journalistUsername ?? '').toLowerCase()
    const source = (c.source ?? '').toLowerCase()
    const titleLower = c.title.toLowerCase()

    // Block Storyful (always embed-blocked)
    if (username.includes('storyful') || source.includes('storyful')) return false

    // Block gaming/entertainment noise
    if (GAMING_TERMS.some(t => titleLower.includes(t))) return false

    // Block paranormal/horror/kids-science noise
    if (NOISE_TERMS.some(t => titleLower.includes(t))) return false
    if (SOFT_NEWS_PATTERNS.some(pattern => pattern.test(c.title))) return false
    if (isSoftAnimalStory(c.title, c.description)) return false

    // WION/Gravitas is useful for hard international news, but its feature/commentary
    // segments create a lot of processing churn. Keep only hard-news titles.
    if (source.includes('wion') && ![
      'war', 'strike', 'missile', 'attack', 'ceasefire', 'protest', 'election',
      'court', 'tariff', 'sanction', 'summit', 'minister', 'military', 'refugee',
      'killed', 'dead', 'detained', 'corruption', 'crisis',
    ].some(term => titleLower.includes(term))) {
      return false
    }

    // Block LIVE streams and BREAKING duplicates — unfinished broadcasts
    if (/\bLIVE\b[:\s]|\|\s*LIVE\s*$|\bBREAKING\b/i.test(c.title)) return false

    // Block Arirang broadcast formats — full shows, weather segments, news specials
    if (/^\[(FULL|LIVE|Weather|NEWS SPECIAL)\]|new day at arirang|arirang news$/i.test(c.title)) return false

    // Block daily headline compilations — these are always multi-story roundups
    if (/top u\.s\. & world headlines|top headlines|daily headlines|morning headlines/i.test(c.title)) return false

    // Block non-Latin script (Japanese/Chinese/Korean/Arabic/Cyrillic) from non-journalist sources
    if (!c.title.match(/[\u0400-\u04ff\u3000-\u9fff\uac00-\ud7ff\u0600-\u06ff]/)) return true
    const isJournalist = !!((c as { journalistUsername?: string | null }).journalistUsername)
    return isJournalist
  })

  // A3: freshness gate — reject candidates whose upload date is too old to run
  // alongside same-day news. Record as a permanent rejection so they aren't
  // re-queued on the next fetch.
  const freshCandidates = filteredCandidates.filter(isFresh)
  const staleCandidates = filteredCandidates.filter(c => !isFresh(c))
  for (const c of staleCandidates) {
    await upsertRejection(supabase, makeSlug(c.platform, c.videoId, c.title), 'stale')
  }

  // Deduplicate across sources — same incident covered by multiple channels keeps highest view count
  const titleDeduped = deduplicateByTitle(freshCandidates)

  // Cross-platform journalist dedup — if a journalist appears on both YouTube and Reddit,
  // keep only the highest viral score version across all platforms
  const journalistBest = new Map<string, typeof titleDeduped[0]>()
  const noJournalist: typeof titleDeduped = []
  for (const c of titleDeduped) {
    const username = (c as { journalistUsername?: string | null }).journalistUsername
    if (!username) { noJournalist.push(c); continue }
    const existing = journalistBest.get(username)
    if (!existing || (c.viralScore ?? 0) > (existing.viralScore ?? 0)) {
      journalistBest.set(username, c)
    }
  }
  const dedupedCandidates = [...noJournalist, ...journalistBest.values()]

  const slugsToCheck = dedupedCandidates.map(c => makeSlug(c.platform, c.videoId, c.title))

  // Check all three tables at once to avoid re-queuing known content
  const todayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: existingStories }, { data: existingRejected }, { data: existingCandidates }, { data: todayStories }, { data: todayCandidates }] =
    await Promise.all([
      supabase.from('stories').select('slug').in('slug', slugsToCheck),
      supabase.from('rejected_slugs').select('slug, expires_at').in('slug', slugsToCheck),
      supabase.from('candidates').select('slug').in('slug', slugsToCheck),
      supabase.from('stories').select('journalist_username').not('journalist_username', 'is', null).gte('created_at', todayCutoff),
      supabase.from('candidates').select('journalist_username').not('journalist_username', 'is', null).gte('fetched_at', todayCutoff),
    ])

  // Count how many stories each journalist already has queued or published today
  const todayJournalistCounts = new Map<string, number>()
  for (const r of [...(todayStories ?? []), ...(todayCandidates ?? [])]) {
    const u = (r as { journalist_username: string }).journalist_username
    todayJournalistCounts.set(u, (todayJournalistCounts.get(u) ?? 0) + 1)
  }

  const now = Date.now()
  const nonExpiredRejected = (existingRejected ?? []).filter(
    (r: { slug: string; expires_at: string | null }) => !r.expires_at || new Date(r.expires_at).getTime() > now
  )

  const knownSlugs = new Set([
    ...(existingStories ?? []).map((r: { slug: string }) => r.slug),
    ...nonExpiredRejected.map((r: { slug: string }) => r.slug),
    ...(existingCandidates ?? []).map((r: { slug: string }) => r.slug),
  ])

  // Apply daily journalist cap across all runs — sort by viral score, keep best
  const sortedCandidates = [...dedupedCandidates].sort((a, b) =>
    (b.viralScore ?? 0) - (a.viralScore ?? 0)
  )

  const newCandidates = sortedCandidates.filter(c => {
    if (knownSlugs.has(makeSlug(c.platform, c.videoId, c.title))) return false
    const username = (c as { journalistUsername?: string | null }).journalistUsername
    if (isSatireSource(username, c.source)) return true
    if (!username) return true
    const count = todayJournalistCounts.get(username) ?? 0
    if (count >= JOURNALIST_DAILY_CAP) return false
    todayJournalistCounts.set(username, count + 1)
    return true
  })

  for (const c of newCandidates) {
    const slug = makeSlug(c.platform, c.videoId, c.title)
    const { error } = await supabase.from('candidates').insert({
      slug,
      title: sanitize(c.title),
      video_url: c.videoUrl,
      platform: c.platform,
      video_id: c.videoId,
      description: sanitize(c.description ?? ''),
      viral_score: c.viralScore,
      source: c.source,
      thumbnail_url: (c as { thumbnailUrl?: string | null }).thumbnailUrl ?? null,
      journalist_username: (c as { journalistUsername?: string | null }).journalistUsername ?? null,
      region: (c as { region?: string | null }).region ?? null,
      duration: (c as { duration?: string | null }).duration ?? null,
      uploaded_at: (c as { uploadedAt?: string | null }).uploadedAt ?? null,
    })
    if (!error) {
      added++
    } else {
      errors.push(`Failed to queue ${slug}: ${error.message}`)
    }
  }

  return { added, errors }
}

const TOPIC_DAILY_CAP = 4
const TOPIC_DAILY_CAP_CRISIS = 8  // higher cap for major developing international stories

// Per-channel daily cap. The 24/7 international broadcasters upload 10-30
// clips/day and were supplying ~68% of all published stories (AJE, DW,
// France 24, WION, TRT, ABC AU, Arirang alone = 479 of 709 in one week),
// crowding US and low-volume institutional sources out of every surface.
// Capping per channel forces breadth across the source library.
const CHANNEL_DAILY_CAP = 5

// A uniform cap of 5 still let 7 foreign broadcasters supply ~55% of the pool
// (each running 3-5/day), starving US-domestic Need To Know. Global broadcasters
// get a tighter cap so a handful of prolific foreign channels can't crowd out
// low-volume US/institutional sources.
const GLOBAL_CHANNEL_DAILY_CAP = 2

// Journalist handles that produce international news — also the source of a
// story's region, and now the tighter-cap set. Module-scope so both the cap
// (channelDailyCap) and the region derivation below share one definition.
const GLOBAL_JOURNALIST_HANDLES = new Set([
  'bbcworldservice', 'channel4news', 'cbcnews', 'abcnewsaustralia',
  'france24english', 'france24', 'dwnews', 'dwenglish', 'dwplaneta', 'dwdocumentary',
  'aljazeeraenglish', 'aljazeera', 'nhkworldjapan', 'nhkworld',
  'arirangnews', 'trtworld', 'wion', 'africanews',
  'reuters', 'afpnewsagency',
])

const GLOBAL_JOURNALIST_REGION: Record<string, string> = {
  'bbcworldservice': 'Europe', 'channel4news': 'Europe', 'cbcnews': 'Canada',
  'abcnewsaustralia': 'Australia', 'france24english': 'Europe', 'france24': 'Europe',
  'dwnews': 'Europe', 'dwenglish': 'Europe', 'dwplaneta': 'Europe', 'dwdocumentary': 'Europe',
  'aljazeeraenglish': 'Middle East', 'aljazeera': 'Middle East',
  'nhkworldjapan': 'Japan', 'nhkworld': 'Japan',
  'arirangnews': 'Korea', 'trtworld': 'Middle East', 'wion': 'South Asia',
  'africanews': 'Africa', 'reuters': 'World', 'afpnewsagency': 'World',
}

const GLOBAL_SOURCE_REGION: Array<[string, string]> = [
  ['france 24', 'Europe'],
  ['france24', 'Europe'],
  ['dw news', 'Europe'],
  ['al jazeera', 'Middle East'],
  ['trt world', 'Middle East'],
  ['wion', 'South Asia'],
  ['abc news australia', 'Australia'],
  ['bbc world service', 'Europe'],
  ['channel 4 news', 'Europe'],
  ['cbc news', 'Canada'],
  ['nhk world', 'Japan'],
  ['arirang news', 'Korea'],
  ['africanews', 'Africa'],
]

// A candidate is from a global broadcaster if its journalist handle is a known
// international channel OR its source name matches one (videos arriving via
// YouTube search carry a source name but no handle).
export function isGlobalBroadcaster(journalistUsername: string | null | undefined, source: string | null | undefined): boolean {
  const handle = (journalistUsername ?? '').toLowerCase()
  if (GLOBAL_JOURNALIST_HANDLES.has(handle)) return true
  const src = (source ?? '').toLowerCase()
  return GLOBAL_SOURCE_REGION.some(([s]) => src.includes(s))
}

// The applicable daily cap for a candidate's channel — tighter for global
// broadcasters, standard for everyone else (US/domestic/institutional).
export function channelDailyCap(journalistUsername: string | null | undefined, source: string | null | undefined): number {
  return isGlobalBroadcaster(journalistUsername, source) ? GLOBAL_CHANNEL_DAILY_CAP : CHANNEL_DAILY_CAP
}

// Keywords that indicate a fast-moving international crisis — these stories get a higher cap
// and a lower MSM bypass threshold so breaking developments don't get silenced
const CRISIS_KEYWORDS = [
  'iran', 'nuclear', 'missile', 'strike', 'war ', 'warfare', 'conflict',
  'invasion', 'nato', 'ceasefire', 'bombing', 'airstrike', 'explosion',
  'earthquake', 'tsunami', 'hurricane', 'flood', 'wildfire',
  'assassination', 'coup', 'protest', 'riot', 'uprising',
]

function isCrisisTopic(title: string): boolean {
  const t = title.toLowerCase()
  return CRISIS_KEYWORDS.some(k => t.includes(k))
}

export function preModelRejectReason(candidate: {
  title: string
  description?: string | null
  source?: string | null
  journalist_username?: string | null
  uploaded_at?: string | null
}): string | null {
  const text = `${candidate.title} ${candidate.description ?? ''} ${candidate.source ?? ''}`.toLowerCase()

  if (/\b(from the archives?|archive documentary|archival|originally aired|retrospective|anniversary|looking back)\b/.test(text)) {
    return 'pre_model_archival: archival or retrospective content does not belong in daily news'
  }

  const entertainmentEvent = /\b(concert|concerts|tour dates?|album release|single release|festival lineup|red carpet|box office|movie trailer)\b/.test(text)
  const publicInterestHook = /\b(lawsuit|strike|union|investigation|arrest|charged|court|policy|regulator|safety|public health|fraud|bankruptcy)\b/.test(text)
  if (entertainmentEvent && !publicInterestHook) {
    return 'pre_model_soft_entertainment: entertainment listings and promotional culture items are out of scope'
  }

  const sportsListing = /\b(match preview|fixtures?|score|scores|lineup|world cup qualifier|kicks off|kickoff|tournament schedule)\b/.test(text)
  const broaderSportsHook = /\b(corruption|fraud|lawsuit|labor|union|safety|abuse|investigation|governance|policy)\b/.test(text)
  if (sportsListing && !broaderSportsHook) {
    return 'pre_model_sports_listing: routine sports listings are out of scope'
  }

  if (isSoftAnimalStory(candidate.title, candidate.description ?? '')) {
    return 'pre_model_soft_animal: animal rescue or nature curiosity without a public-interest angle'
  }

  return null
}

export function shouldGenerateMajorSections(params: {
  coverageCount: number
  candidateRegion: string | null
  sourceTier: number | null
  sourceType: string | null
  category?: string | null
}): boolean {
  if (process.env.ENABLE_MAJOR_STORY_SECTIONS === 'false') return false
  if (params.coverageCount < 5) return false
  if (params.candidateRegion) return false
  if (params.category === 'analysis' || params.category === 'raw' || params.category === 'comedy') return false
  if (params.sourceTier === null) return false
  if (params.sourceTier > 5) return false
  return params.sourceType !== 'Mainstream Pulse'
}

// Phase 2: process the next pending candidates from the queue through Claude.
export async function runProcess(limit = 3): Promise<PipelineResult> {
  const supabase = getSupabase()
  const anthropicKey = process.env.ANTHROPIC_API_KEY!
  const result: PipelineResult = { inserted: 0, needsReview: 0, rejected: 0, held: 0, errors: [], stories: [] }

  // Process the FRESHEST candidates first. Each story now costs several
  // sequential Claude calls (verify → classify → QC gate → section-QC), so a
  // time-boxed ingest run only clears a slice of the queue. Oldest-first
  // (the previous order) meant the newest, most-current stories were the ones
  // left unprocessed when the budget ran out — today's breaking news would sit
  // in the backlog while stale recaps got ingested, which is why editions read
  // dated. Newest-first ensures current news is what actually reaches the pool;
  // genuinely old candidates age out via the freshness gate and cleanup.
  const { data: pending, error: fetchError } = await supabase
    .from('candidates')
    .select('*')
    .eq('processed', false)
    .order('fetched_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10))

  if (fetchError) {
    result.errors.push(`Failed to fetch candidates queue: ${fetchError.message}`)
    return result
  }

  if (!pending || pending.length === 0) {
    result.errors.push('No pending candidates in queue — run Fetch first')
    return result
  }

  const publishedSlugs: string[] = []

  // Load tier overrides from featured_journalists — used for community-accepted sources
  // that aren't yet in the static source-tier.ts lookup table
  const { data: journalistRows } = await supabase
    .from('featured_journalists')
    .select('username, source_tier, source_type')
    .not('source_tier', 'is', null)

  const journalistTierMap = new Map<string, { tier: number; sourceType: string }>(
    (journalistRows ?? [])
      .filter((r: { username: string; source_tier: number | null; source_type: string | null }) =>
        r.source_tier !== null && r.source_type !== null
      )
      .map((r: { username: string; source_tier: number; source_type: string }) => [
        r.username.toLowerCase(),
        { tier: r.source_tier, sourceType: r.source_type },
      ])
  )

  // Fetch today's published stories for topic diversity + per-channel caps
  const todayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: todayPublished } = await supabase
    .from('stories')
    .select('title, source')
    .eq('published', true)
    .gte('created_at', todayCutoff)

  const publishedTitles: string[] = (todayPublished ?? []).map((r: { title: string }) => r.title)

  // Published-story count per channel in the last 24h — enforces CHANNEL_DAILY_CAP
  const channelCounts = new Map<string, number>()
  for (const r of (todayPublished ?? []) as { source: string | null }[]) {
    if (r.source) channelCounts.set(r.source, (channelCounts.get(r.source) ?? 0) + 1)
  }
  function bumpChannelCount(source: string | null | undefined) {
    if (source) channelCounts.set(source, (channelCounts.get(source) ?? 0) + 1)
  }

  // Count topic clusters already published today — used to enforce TOPIC_DAILY_CAP
  // Rules:
  // 1. MSM bypass: if 15+ outlets have covered it, it's confirmed major news — never cap it
  // 2. Crisis topics get a higher cap (TOPIC_DAILY_CAP_CRISIS) so developing stories
  //    can keep flowing through without being silenced after the 4th hit
  // 3. Routine topics are capped at TOPIC_DAILY_CAP
  function topicAlreadyCapped(candidateTitle: string, msmArticleCount: number): boolean {
    if (msmArticleCount >= 15) return false  // 15+ outlets = confirmed major news, always let through
    const cap = isCrisisTopic(candidateTitle) ? TOPIC_DAILY_CAP_CRISIS : TOPIC_DAILY_CAP
    let overlap = 0
    for (const published of publishedTitles) {
      if (isSameIncident(candidateTitle, published, 2)) overlap++
    }
    return overlap >= cap
  }

  // Mainstream Pulse handles — bypass Claude verification; skip MSM gap check (circular for MSM sources)
  const MAINSTREAM_PULSE_HANDLES = new Set([
    'nytimes', 'associatedpress', 'wsj', 'foxnews', 'npr', 'reuters',
  ])

  for (const candidate of pending) {
    try {
      const preRejectReason = preModelRejectReason(candidate)
      if (preRejectReason) {
        result.rejected++
        result.errors.push(`Pre-model reject: "${candidate.title.slice(0, 50)}" — ${preRejectReason}`)
        await upsertRejection(supabase, candidate.slug, preRejectReason)
        await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
        continue
      }

      // Per-channel daily cap — free check, runs before any paid lookups.
      // TTL'd rejection: the cap is about today's volume, not the content.
      // Global broadcasters get a tighter cap so a few prolific foreign channels
      // can't crowd US/domestic sources out of the pool.
      const channelKey = candidate.source ?? ''
      const cap = channelDailyCap(candidate.journalist_username, candidate.source)
      if ((channelCounts.get(channelKey) ?? 0) >= cap) {
        result.rejected++
        result.errors.push(`Channel cap: "${candidate.title.slice(0, 50)}" — ${channelKey} already has ${cap} published stories in 24h`)
        await upsertRejection(supabase, candidate.slug, `channel_cap: ${channelKey} reached ${cap} published stories in 24h`)
        await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
        continue
      }

      // A3: oEmbed check first — it's free, so reject embed-blocked videos
      // before spending anything on MSM lookups or Claude calls.
      if (candidate.platform === 'youtube') {
        const embeddable = await isYouTubeEmbeddable(candidate.video_url)
        if (!embeddable) {
          result.rejected++
          result.errors.push(`Embed blocked: "${candidate.title.slice(0, 50)}" — YouTube embed disabled by rights holder`)
          await upsertRejection(supabase, candidate.slug, 'youtube_embed_blocked')
          await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
          continue
        }
      }

      const msm = await checkMSMCoverage(candidate.title)
      if (msm.throttled) {
        console.warn(`[ingest] MSM coverage throttled for "${candidate.title.slice(0, 50)}" — stored count (${msm.coveredBy.length}) may be low; digest re-check will correct it`)
      }
      await delay(200)

      const handle = (candidate.journalist_username ?? '').toLowerCase()
      const isGlobalJournalist = GLOBAL_JOURNALIST_HANDLES.has(handle)
      const sourceLower = (candidate.source ?? '').toLowerCase()
      const sourceRegion = GLOBAL_SOURCE_REGION.find(([source]) => sourceLower.includes(source))?.[1] ?? null
      const rawRegion = candidate.region ?? (isGlobalJournalist ? (GLOBAL_JOURNALIST_REGION[handle] ?? 'World') : sourceRegion)
      // Reconcile the channel-derived region against the places NAMED in the text.
      // Region is otherwise the source channel's home region, so a global channel
      // covering elsewhere is mislabeled (WION on Lebanon → "South Asia", Al Jazeera
      // on Congo → "Middle East"). Correct to the dominant named region; cross-region
      // coverage stays published with the right tag. (Classification consistency A1.)
      const regionCheck = reconcileRegion(rawRegion, `${candidate.title ?? ''} ${candidate.description ?? ''}`)
      const candidateRegion = regionCheck.region
      if (regionCheck.corrected) {
        console.warn(`[ingest] region corrected for ${candidate.slug}: ${regionCheck.reason}`)
      }

      // Satire bypass — skip Claude verification for known comedy/satire creators
      const isSatire = isSatireSource(candidate.journalist_username, candidate.source)
      if (isSatire) {
        const satireSourceTier = getSourceTier(candidate.journalist_username ?? null, candidate.source ?? '', 'comedy').tier
        const satireSummary = await summarizeLight(
          {
            title: candidate.title,
            channel: candidate.source ?? '',
            description: candidate.description ?? '',
            duration: candidate.duration ?? null,
            category: 'comedy',
          },
          anthropicKey
        )
        const satireQC = await runQCAndInsert(
          supabase,
          anthropicKey,
          {
            title: satireSummary.headline,
            slug: candidate.slug,
            description: satireSummary.summary,
            embed_url: candidate.video_url,
            platform: candidate.platform,
            view_count: candidate.viral_score,
            share_count: 0,
            msm_gap: false,
            msm_outlet_coverage: { covered: [], notCovered: [] },
            source: candidate.source,
            msm_notes: `Source: ${candidate.source} | Satire bypass`,
            published: true,
            display_order: 80,
            category: 'comedy',
            thumbnail_url: candidate.thumbnail_url ?? null,
            journalist_username: candidate.journalist_username ?? (
              sourceLower.includes('saturday night live') ? 'saturdaynightlive' :
              sourceLower.includes('the daily show') ? 'thedailyshow' :
              sourceLower.includes('last week tonight') ? 'lastweektonight' :
              sourceLower.includes('jonathan pie') ? 'jonathanpie' :
              sourceLower.includes('some more news') ? 'smn' :
              sourceLower.includes('josh johnson') ? 'joshjohnsoncomedy' :
              sourceLower.includes('the juice media') ? 'thejuicemedia' :
              null
            ),
            region: null,
            duration: candidate.duration ?? null,
            source_tier: satireSourceTier,
            source_type: 'satire',
            verified_interpretation: null,
          },
          {
            section: 'comedy',
            contentType: 'satire',
            confidenceLabel: 'Satire',
            sourceName: candidate.source ?? '',
            sourceTier: satireSourceTier,
            coverageCount: 0,
            rawSourceDescription: candidate.description ?? '',
            eventDateEstimate: candidate.fetched_at ? candidate.fetched_at.slice(0, 10) : null,
            videoPublishDate: candidate.uploaded_at ? candidate.uploaded_at.slice(0, 10) : null,
          }
        )
        await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
        if (satireQC.duplicate) {
          result.stories.push({ title: satireSummary.headline, slug: candidate.slug, decision: 'duplicate' })
        } else if (satireQC.error) {
          result.errors.push(`Satire insert error: ${satireQC.error}`)
        } else if (satireQC.held) {
          result.held++
          result.stories.push({ title: satireSummary.headline, slug: candidate.slug, decision: 'hold' })
        } else {
          result.inserted++
          bumpChannelCount(candidate.source)
          result.stories.push({ title: satireSummary.headline, slug: candidate.slug, decision: 'publish' })
          await tagStoryBySlug(supabase, candidate.slug).catch(err => {
            result.errors.push(`Tagging failed for ${candidate.slug}: ${err instanceof Error ? err.message : String(err)}`)
          })
        }
        continue
      }

      // Mainstream Pulse bypass — skip Claude verification; MSM gap check is circular for these sources
      if (MAINSTREAM_PULSE_HANDLES.has(handle)) {
        const mainstreamSummary = await summarizeLight(
          {
            title: candidate.title,
            channel: candidate.source ?? '',
            description: candidate.description ?? '',
            duration: candidate.duration ?? null,
            category: 'mainstream_pulse',
          },
          anthropicKey
        )
        const mainstreamQC = await runQCAndInsert(
          supabase,
          anthropicKey,
          {
            title: mainstreamSummary.headline,
            slug: candidate.slug,
            description: mainstreamSummary.summary,
            embed_url: candidate.video_url,
            platform: candidate.platform,
            view_count: candidate.viral_score,
            share_count: 0,
            msm_gap: false,
            msm_outlet_coverage: { covered: [], notCovered: [] },
            source: candidate.source,
            msm_notes: `Source: ${candidate.source} | Mainstream Pulse bypass`,
            published: true,
            display_order: 90,
            category: 'reported',
            thumbnail_url: candidate.thumbnail_url ?? null,
            journalist_username: handle || null,
            region: null,
            duration: candidate.duration ?? null,
            source_tier: 6,
            source_type: 'Mainstream Pulse',
            verified_interpretation: null,
          },
          {
            section: 'reported',
            contentType: 'reported',
            confidenceLabel: 'Reported',
            sourceName: candidate.source ?? '',
            sourceTier: 6,
            coverageCount: 0,
            rawSourceDescription: candidate.description ?? '',
            eventDateEstimate: candidate.fetched_at ? candidate.fetched_at.slice(0, 10) : null,
            videoPublishDate: candidate.uploaded_at ? candidate.uploaded_at.slice(0, 10) : null,
          }
        )
        await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
        if (mainstreamQC.duplicate) {
          result.stories.push({ title: mainstreamSummary.headline, slug: candidate.slug, decision: 'duplicate' })
        } else if (mainstreamQC.error) {
          result.errors.push(`Mainstream insert error: ${mainstreamQC.error}`)
        } else if (mainstreamQC.held) {
          result.held++
          result.stories.push({ title: mainstreamSummary.headline, slug: candidate.slug, decision: 'hold' })
        } else {
          result.inserted++
          bumpChannelCount(candidate.source)
          result.stories.push({ title: mainstreamSummary.headline, slug: candidate.slug, decision: 'publish' })
          await tagStoryBySlug(supabase, candidate.slug).catch(err => {
            result.errors.push(`Tagging failed for ${candidate.slug}: ${err instanceof Error ? err.message : String(err)}`)
          })
        }
        continue
      }

      if (topicAlreadyCapped(candidate.title, msm.articleCount)) {
        result.rejected++
        result.errors.push(
          `Topic cap: "${candidate.title.slice(0, 50)}" — too many similar stories today`
        )
        await upsertRejection(supabase, candidate.slug, 'topic_cap: too many similar stories today')
        await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)
        continue
      }

      const preTier = getSourceTier(candidate.journalist_username ?? null, candidate.source, null)
      const preHandleLower = (candidate.journalist_username ?? '').toLowerCase()
      const preDbOverride = preHandleLower ? journalistTierMap.get(preHandleLower) : undefined
      const preIsGenericFallback = preTier.tier === null || (preTier.tier === 7 && preTier.sourceType === 'Independent Commentary' && preDbOverride)
      const preFinalTier = preIsGenericFallback && preDbOverride ? preDbOverride.tier : preTier.tier
      const preFinalSourceType = preIsGenericFallback && preDbOverride ? preDbOverride.sourceType : preTier.sourceType
      const isMajorStory = shouldGenerateMajorSections({
        coverageCount: msm.coveredBy.length,
        candidateRegion,
        sourceTier: preFinalTier,
        sourceType: preFinalSourceType,
      })

      const verification = await verifyAndTitle(
        {
          title: candidate.title,
          description: candidate.description ?? '',
          platform: candidate.platform,
          source: candidate.source,
          viralScore: candidate.viral_score,
          msmArticleCount: msm.articleCount,
          msmGap: msm.msmGap,
          isJournalist: !!candidate.journalist_username,
          isGlobal: !!candidateRegion,
          region: candidateRegion,
          isMajor: isMajorStory,
        },
        anthropicKey
      )
      await delay(100)

      // Mark processed regardless of outcome
      await supabase.from('candidates').update({ processed: true }).eq('slug', candidate.slug)

      result.stories.push({
        title: verification.headline,
        slug: candidate.slug,
        decision: verification.decision,
      })

      if (verification.decision === 'reject') {
        result.rejected++
        result.errors.push(
          `Rejected: "${candidate.title.slice(0, 50)}" — ${verification.rejectReason ?? 'no reason'}`
        )
        await upsertRejection(supabase, candidate.slug, verification.rejectReason ?? '')
        continue
      }

      // Resolve source tier — prefer the static lookup, falling back to a
      // DB-stored override from featured_journalists (set when a community
      // submission was accepted with a specific tier assigned by the editor)
      const { tier, sourceType } = getSourceTier(candidate.journalist_username ?? null, candidate.source, verification.category ?? null)
      const handleLower = (candidate.journalist_username ?? '').toLowerCase()
      const dbOverride = handleLower ? journalistTierMap.get(handleLower) : undefined
      const isGenericFallback = tier === null || (tier === 7 && sourceType === 'Independent Commentary' && dbOverride)
      const finalTier = isGenericFallback && dbOverride ? dbOverride.tier : tier
      const finalSourceType = isGenericFallback && dbOverride ? dbOverride.sourceType : sourceType

      // Third-party reposts of newsroom content never enter the lanes — we
      // surface the publisher of record, not the reposter. Only applies when
      // the account itself doesn't resolve to a known publisher (an outlet
      // posting its own content on TikTok resolves to its real tier above).
      if (verification.repostSuspected && (finalTier === null || finalTier >= 9)) {
        result.rejected++
        result.errors.push(`Repost suspected: "${candidate.title.slice(0, 50)}" — third-party repost of newsroom content (${candidate.source})`)
        await upsertRejection(supabase, candidate.slug, 'repost_suspected: third-party repost of newsroom content')
        continue
      }

      const coverageCount = msm.coveredBy.length

      // Tier 8-10 / unrecognized sources with zero outlet coverage are held
      // for human review instead of auto-publishing with a Single-source label.
      const corroborationHold = needsCorroborationHold(finalTier, coverageCount)
      if (corroborationHold) {
        const entry = result.stories.find(s => s.slug === candidate.slug)
        if (entry) entry.decision = 'needs_review'
      }

      // Spec 3.2 — unified classification pass: a separate temp-0, enum-validated,
      // injection-hardened call producing {content_type, topic_role, section_fit}.
      // An embedded classify/publish/confidence directive in the source text is
      // caught deterministically and forces needs_review (held unpublished).
      const classification = await classifyStory(
        { title: candidate.title, description: candidate.description ?? '' },
        anthropicKey
      )
      await delay(100)
      const classifyHold = classification.injectionDetected
      if (classifyHold) {
        const entry = result.stories.find(s => s.slug === candidate.slug)
        if (entry) entry.decision = 'needs_review'
        result.errors.push(`Classification injection held: "${candidate.title.slice(0, 50)}" — ${classification.reason ?? 'embedded directive'}`)
      }

      // verification.category is raw/reported/analysis — never comedy — so the
      // label is always non-null here; 'Reported' fallback satisfies the types.
      const confidenceLabel = CONFIDENCE_META[getConfidenceLabel({
        category: verification.category,
        source_tier: finalTier,
        msm_outlet_coverage: { covered: msm.coveredBy, notCovered: msm.notCoveredBy },
        msm_gap: verification.msmGap,
      }) ?? 'REPORTED'].label as QCConfidenceLabel
      // QC content_type only distinguishes reported/analysis/satire — "raw" footage is QC'd as "reported"
      const qcContentType = verification.category === 'analysis' ? 'analysis' : 'reported'

      // Phase 3: blocking section QC for major-story page sections. Failed
      // sections are stripped (null); the story still publishes. A story is
      // "developing" when its confidence label is Developing or Single-source.
      let majorSections = { inContext: null as string | null, whatWeKnow: null as string[] | null, whatRemainsUnclear: null as string[] | null }
      if (isMajorStory) {
        const isDeveloping = confidenceLabel === 'Developing' || confidenceLabel === 'Single-source'
        const { sections, dropped } = runSectionQC({
          inContext: verification.inContext,
          whatWeKnow: verification.whatWeKnow,
          whatRemainsUnclear: verification.whatRemainsUnclear,
          isDeveloping,
        })
        majorSections = sections
        if (dropped.length > 0) {
          result.errors.push(`Section QC dropped [${dropped.join(', ')}] for "${candidate.slug}"`)
        }
        if (verification.usage) {
          result.errors.push(`Major-story gen cost ${candidate.slug}: in=${verification.usage.inputTokens} out=${verification.usage.outputTokens} tokens`)
        }
      }

      const qc = await runQCAndInsert(
        supabase,
        anthropicKey,
        {
          title: verification.headline,
          slug: candidate.slug,
          description: verification.summary,
          embed_url: candidate.video_url,
          platform: candidate.platform,
          view_count: candidate.viral_score,
          share_count: 0,
          msm_gap: verification.msmGap,
          msm_outlet_coverage: { covered: msm.coveredBy, notCovered: msm.notCoveredBy },
          source: candidate.source,
          msm_notes: `Source: ${candidate.source} | Confidence: ${verification.confidence} | Status: ${verification.decision}${corroborationHold ? ` | Corroboration hold: tier ${finalTier ?? 'unknown'} with 0 outlet coverage` : ''}${classifyHold ? ' | Classification injection hold' : ''}`,
          published: (verification.decision === 'publish' || verification.decision === 'needs_review') && !corroborationHold && !classifyHold,
          display_order: verification.decision === 'publish' ? (verification.msmGap ? 30 : 50) : 75,
          category: verification.category,
          content_type: classification.content_type,
          topic_role: classification.topic_role,
          section_fit: classification.section_fit,
          thumbnail_url: candidate.thumbnail_url ?? null,
          journalist_username: candidate.journalist_username ?? null,
          region: candidateRegion,
          duration: candidate.duration ?? null,
          verified_interpretation: verification.verifiedInterpretation ?? null,
          in_context: majorSections.inContext,
          what_we_know: majorSections.whatWeKnow,
          what_remains_unclear: majorSections.whatRemainsUnclear,
          source_tier: finalTier,
          source_type: finalSourceType,
        },
        {
          section: verification.category,
          contentType: qcContentType,
          confidenceLabel,
          sourceName: candidate.source ?? '',
          sourceTier: finalTier,
          coverageCount,
          rawSourceDescription: candidate.description ?? '',
          eventDateEstimate: candidate.fetched_at ? candidate.fetched_at.slice(0, 10) : null,
        }
      )

      if (qc.duplicate) {
        result.stories.push({ title: verification.headline, slug: candidate.slug, decision: 'duplicate' })
        continue
      }

      if (qc.error) {
        result.errors.push(`Failed to insert ${candidate.slug}: ${qc.error}`)
        continue
      }

      if (qc.held) {
        result.held++
      } else if (verification.decision === 'needs_review' || corroborationHold) {
        result.needsReview++
      } else {
        result.inserted++
        bumpChannelCount(candidate.source)
        publishedSlugs.push(candidate.slug)
        await tagStoryBySlug(supabase, candidate.slug).catch(err => {
          result.errors.push(`Tagging failed for ${candidate.slug}: ${err instanceof Error ? err.message : String(err)}`)
        })
      }

      // Add to in-memory published list so topic cap applies within this run too
      publishedTitles.push(verification.headline)
    } catch (err) {
      result.errors.push(
        `Error processing ${candidate.slug}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Ping IndexNow with all newly published story URLs
  await pingIndexNow(publishedSlugs)

  return result
}

// Convenience: fetch + process in one call (used by existing /api/ingest route)
export async function runIngestionPipeline(): Promise<PipelineResult & { queued: number }> {
  const fetchResult = await runFetch()
  const processResult = await runProcess()
  return {
    ...processResult,
    queued: fetchResult.added,
    errors: [...fetchResult.errors, ...processResult.errors],
  }
}
