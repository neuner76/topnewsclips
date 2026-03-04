import { createClient } from '@supabase/supabase-js'
import { fetchRedditClips, type RedditClip } from './reddit'
import { fetchYouTubeTrending, type YouTubeClip } from './youtube'
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
    supabase.from('featured_journalists').select('username').eq('active', true).eq('platform', 'youtube'),
  ])
  const journalistUsernames = (tiktokJournalistRows ?? []).map((r: { username: string }) => r.username)
  const youtubeJournalistHandles = (youtubeJournalistRows ?? []).map((r: { username: string }) => r.username)

  const [redditResult, youtubeResult, tiktokResult] = await Promise.all([
    fetchRedditClips(),
    youtubeKey
      ? fetchYouTubeTrending(youtubeKey, youtubeJournalistHandles)
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

  const slugsToCheck = candidates.map(c => makeSlug(c.platform, c.videoId, c.title))

  // Check all three tables at once to avoid re-queuing known content
  const [{ data: existingStories }, { data: existingRejected }, { data: existingCandidates }] =
    await Promise.all([
      supabase.from('stories').select('slug').in('slug', slugsToCheck),
      supabase.from('rejected_slugs').select('slug').in('slug', slugsToCheck),
      supabase.from('candidates').select('slug').in('slug', slugsToCheck),
    ])

  const knownSlugs = new Set([
    ...(existingStories ?? []).map((r: { slug: string }) => r.slug),
    ...(existingRejected ?? []).map((r: { slug: string }) => r.slug),
    ...(existingCandidates ?? []).map((r: { slug: string }) => r.slug),
  ])

  const newCandidates = candidates.filter(
    c => !knownSlugs.has(makeSlug(c.platform, c.videoId, c.title))
  )

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
    .limit(10)

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
        published: false,
        display_order: 99,
        category: verification.category,
        subcategory: verification.subcategory ?? null,
        thumbnail_url: candidate.thumbnail_url ?? null,
        journalist_username: candidate.journalist_username ?? null,
      })

      if (error) {
        result.errors.push(`Failed to insert ${candidate.slug}: ${error.message}`)
        continue
      }

      // Auto-pin if from a featured journalist and no story from them is already pinned in this category
      if (candidate.journalist_username && verification.category) {
        const { data: existingPin } = await supabase
          .from('stories')
          .select('id')
          .eq('journalist_username', candidate.journalist_username)
          .eq('category', verification.category)
          .eq('pinned', true)
          .limit(1)
        if (!existingPin || existingPin.length === 0) {
          await supabase.from('stories').update({ pinned: true }).eq('slug', candidate.slug)
        }
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
