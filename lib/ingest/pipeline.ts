import { createClient } from '@supabase/supabase-js'
import { fetchYouTubeTrending, resolveYouTubeChannelId, type YouTubeClip } from './youtube'
import { fetchTikTokTrending, type TikTokClip } from './tiktok'
import { fetchGlobalClips, type GlobalClip } from './global'
import { checkMSMCoverage } from './msm-check'
import { verifyAndTitle } from './claude-verify'
import { pingIndexNow } from './indexnow'
import { getSourceTier } from './source-tier'

export interface PipelineResult {
  inserted: number
  needsReview: number
  rejected: number
  errors: string[]
  stories: Array<{ title: string; slug: string; decision: string }>
}

export interface FetchResult {
  added: number
  errors: string[]
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

const JOURNALIST_DAILY_CAP = 3

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
  const filteredCandidates = candidates.filter(c => {
    const username = ((c as { journalistUsername?: string | null }).journalistUsername ?? '').toLowerCase()
    const source = (c.source ?? '').toLowerCase()
    const titleLower = c.title.toLowerCase()

    // Block Storyful (always embed-blocked)
    if (username.includes('storyful') || source.includes('storyful')) return false

    // Block gaming/entertainment content
    if (GAMING_TERMS.some(t => titleLower.includes(t))) return false

    // Block non-English (Japanese/Chinese/Korean/Arabic characters) from non-journalist sources
    if (!c.title.match(/[\u3000-\u9fff\uac00-\ud7ff\u0600-\u06ff]/)) return true
    // If non-Latin script detected, only allow if it's a journalist source
    const isJournalist = !!((c as { journalistUsername?: string | null }).journalistUsername)
    return isJournalist
  })

  // Deduplicate across sources — same incident covered by multiple channels keeps highest view count
  const titleDeduped = deduplicateByTitle(filteredCandidates)

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
      supabase.from('rejected_slugs').select('slug').in('slug', slugsToCheck),
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

  const knownSlugs = new Set([
    ...(existingStories ?? []).map((r: { slug: string }) => r.slug),
    ...(existingRejected ?? []).map((r: { slug: string }) => r.slug),
    ...(existingCandidates ?? []).map((r: { slug: string }) => r.slug),
  ])

  // Apply daily journalist cap across all runs — sort by viral score, keep best
  const sortedCandidates = [...dedupedCandidates].sort((a, b) =>
    (b.viralScore ?? 0) - (a.viralScore ?? 0)
  )
  const newCandidates = sortedCandidates.filter(c => {
    if (knownSlugs.has(makeSlug(c.platform, c.videoId, c.title))) return false
    const username = (c as { journalistUsername?: string | null }).journalistUsername
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
      title: c.title,
      video_url: c.videoUrl,
      platform: c.platform,
      video_id: c.videoId,
      description: c.description,
      viral_score: c.viralScore,
      source: c.source,
      thumbnail_url: (c as { thumbnailUrl?: string | null }).thumbnailUrl ?? null,
      journalist_username: (c as { journalistUsername?: string | null }).journalistUsername ?? null,
      region: (c as { region?: string | null }).region ?? null,
      duration: (c as { duration?: string | null }).duration ?? null,
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

// Phase 2: process next 10 pending candidates from the queue through Claude
export async function runProcess(): Promise<PipelineResult> {
  const supabase = getSupabase()
  const anthropicKey = process.env.ANTHROPIC_API_KEY!
  const result: PipelineResult = { inserted: 0, needsReview: 0, rejected: 0, errors: [], stories: [] }

  const { data: pending, error: fetchError } = await supabase
    .from('candidates')
    .select('*')
    .eq('processed', false)
    .order('fetched_at', { ascending: true })
    .limit(12)

  if (fetchError) {
    result.errors.push(`Failed to fetch candidates queue: ${fetchError.message}`)
    return result
  }

  if (!pending || pending.length === 0) {
    result.errors.push('No pending candidates in queue — run Fetch first')
    return result
  }

  const publishedSlugs: string[] = []

  // Fetch today's published story titles for topic diversity enforcement
  const todayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: todayPublished } = await supabase
    .from('stories')
    .select('title')
    .eq('published', true)
    .gte('created_at', todayCutoff)

  const publishedTitles: string[] = (todayPublished ?? []).map((r: { title: string }) => r.title)

  // Count topic clusters already published today — used to enforce TOPIC_DAILY_CAP
  // Each published title may be representative of a topic cluster; we track overlap counts
  function topicAlreadyCapped(candidateTitle: string): boolean {
    let overlap = 0
    for (const published of publishedTitles) {
      if (isSameIncident(candidateTitle, published, 2)) overlap++
    }
    return overlap >= TOPIC_DAILY_CAP
  }

  for (const candidate of pending) {
    try {
      const msm = await checkMSMCoverage(candidate.title)
      await delay(200)

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
          isGlobal: !!candidate.region,
          region: candidate.region ?? null,
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
        await supabase
          .from('rejected_slugs')
          .upsert({ slug: candidate.slug, reason: verification.rejectReason ?? '' })
        continue
      }

      // YouTube embed check — reject videos blocked from third-party embedding
      if (candidate.platform === 'youtube') {
        const embeddable = await isYouTubeEmbeddable(candidate.video_url)
        if (!embeddable) {
          result.rejected++
          result.errors.push(
            `Embed blocked: "${candidate.title.slice(0, 50)}" — YouTube embed disabled by rights holder`
          )
          await supabase
            .from('rejected_slugs')
            .upsert({ slug: candidate.slug, reason: 'youtube_embed_blocked' })
          continue
        }
      }

      // Topic diversity cap — skip if this topic already has TOPIC_DAILY_CAP stories published today
      if (topicAlreadyCapped(verification.headline)) {
        result.rejected++
        result.errors.push(
          `Topic cap: "${verification.headline.slice(0, 50)}" — too many similar stories today`
        )
        await supabase
          .from('rejected_slugs')
          .upsert({ slug: candidate.slug, reason: 'topic_cap: too many similar stories today' })
        continue
      }

      const { error } = await supabase.from('stories').insert({
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
        msm_notes: `Source: ${candidate.source} | Confidence: ${verification.confidence} | Status: ${verification.decision}`,
        published: verification.decision === 'publish' || verification.decision === 'needs_review',
        display_order: verification.decision === 'publish' ? (verification.msmGap ? 30 : 50) : verification.decision === 'needs_review' ? 75 : 99,
        category: verification.category,
        thumbnail_url: candidate.thumbnail_url ?? null,
        journalist_username: candidate.journalist_username ?? null,
        region: candidate.region ?? null,
        duration: candidate.duration ?? null,
        ...(() => {
          const { tier, sourceType } = getSourceTier(candidate.journalist_username ?? null, candidate.source, verification.category ?? null)
          return { source_tier: tier, source_type: sourceType }
        })(),
      })

      if (error) {
        result.errors.push(`Failed to insert ${candidate.slug}: ${error.message}`)
        continue
      }

      if (verification.decision === 'needs_review') {
        result.needsReview++
      } else {
        result.inserted++
        publishedSlugs.push(candidate.slug)
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
