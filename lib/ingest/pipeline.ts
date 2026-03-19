import { createClient } from '@supabase/supabase-js'
import { fetchRedditClips, type RedditClip } from './reddit'
import { fetchYouTubeTrending, resolveYouTubeChannelId, type YouTubeClip } from './youtube'
import { fetchTikTokTrending, type TikTokClip } from './tiktok'
import { checkMSMCoverage } from './msm-check'
import { verifyAndTitle } from './claude-verify'

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

  const [redditResult, youtubeResult, tiktokResult] = await Promise.all([
    fetchRedditClips(),
    youtubeKey
      ? fetchYouTubeTrending(youtubeKey, youtubeJournalists)
      : Promise.resolve({ clips: [], errors: ['YOUTUBE_API_KEY not set'] }),
    apifyKey
      ? fetchTikTokTrending(apifyKey, journalistUsernames)
      : Promise.resolve({ clips: [], errors: [] }),
  ])

  errors.push(...redditResult.errors, ...youtubeResult.errors, ...tiktokResult.errors)

  const candidates = [
    ...redditResult.clips.map((c: RedditClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: c.platform as string,
      videoId: c.videoId,
      description: '',
      viralScore: c.redditScore,
      source: `r/${c.subreddit}`,
    })),
    ...youtubeResult.clips.map((c: YouTubeClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: 'youtube',
      videoId: c.videoId,
      description: c.description,
      viralScore: c.viewCount,
      source: `YouTube/${c.channelTitle}`,
      journalistUsername: c.journalistUsername ?? null,
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
  ]

  if (candidates.length === 0) {
    errors.push('No candidates fetched from any source')
    return { added, errors }
  }

  // Deduplicate across sources — same incident covered by multiple channels keeps highest view count
  const dedupedCandidates = deduplicateByTitle(candidates)

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
    })
    if (!error) {
      added++
    } else {
      errors.push(`Failed to queue ${slug}: ${error.message}`)
    }
  }

  return { added, errors }
}

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
    .limit(5)

  if (fetchError) {
    result.errors.push(`Failed to fetch candidates queue: ${fetchError.message}`)
    return result
  }

  if (!pending || pending.length === 0) {
    result.errors.push('No pending candidates in queue — run Fetch first')
    return result
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

      const { error } = await supabase.from('stories').insert({
        title: verification.headline,
        slug: candidate.slug,
        description: verification.summary,
        embed_url: candidate.video_url,
        platform: candidate.platform,
        view_count: candidate.viral_score,
        share_count: 0,
        msm_gap: verification.msmGap,
        msm_notes: `Source: ${candidate.source} | Confidence: ${verification.confidence} | Status: ${verification.decision}`,
        published: verification.decision === 'publish',
        display_order: verification.decision === 'publish' ? 50 : 99,
        category: verification.category,
        thumbnail_url: candidate.thumbnail_url ?? null,
        journalist_username: candidate.journalist_username ?? null,
      })

      if (error) {
        result.errors.push(`Failed to insert ${candidate.slug}: ${error.message}`)
        continue
      }

      if (verification.decision === 'needs_review') {
        result.needsReview++
      } else {
        result.inserted++
      }
    } catch (err) {
      result.errors.push(
        `Error processing ${candidate.slug}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

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
