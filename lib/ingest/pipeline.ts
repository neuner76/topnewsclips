import { createClient } from '@supabase/supabase-js'
import { fetchRedditClips, type RedditClip } from './reddit'
import { fetchYouTubeTrending, type YouTubeClip } from './youtube'
import { checkMSMCoverage } from './msm-check'
import { verifyAndTitle } from './claude-verify'

export interface PipelineResult {
  inserted: number
  needsReview: number
  rejected: number
  errors: string[]
  stories: Array<{ title: string; slug: string; decision: string }>
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

export async function runIngestionPipeline(): Promise<PipelineResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anthropicKey = process.env.ANTHROPIC_API_KEY!
  const youtubeKey = process.env.YOUTUBE_API_KEY

  const supabase = createClient(supabaseUrl, supabaseKey)
  const result: PipelineResult = { inserted: 0, needsReview: 0, rejected: 0, errors: [], stories: [] }

  // 1. Fetch candidates from Reddit + YouTube
  const [redditResult, youtubeResult] = await Promise.all([
    fetchRedditClips(),
    youtubeKey ? fetchYouTubeTrending(youtubeKey) : Promise.resolve({ clips: [], errors: ['YOUTUBE_API_KEY not set'] }),
  ])

  result.errors.push(...redditResult.errors, ...youtubeResult.errors)

  const redditClips = redditResult.clips
  const youtubeClips = youtubeResult.clips

  // Normalize to a unified candidate shape
  type Candidate = {
    title: string
    videoUrl: string
    platform: 'youtube' | 'tiktok' | 'x'
    videoId: string | null
    description: string
    viralScore: number
    source: string
  }

  const candidates: Candidate[] = [
    ...redditClips.map((c: RedditClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: c.platform,
      videoId: c.videoId,
      description: '',
      viralScore: c.redditScore,
      source: `r/${c.subreddit}`,
    })),
    ...youtubeClips.map((c: YouTubeClip) => ({
      title: c.title,
      videoUrl: c.videoUrl,
      platform: 'youtube' as const,
      videoId: c.videoId,
      description: c.description,
      viralScore: c.viewCount,
      source: `YouTube/${c.channelTitle}`,
    })),
  ]

  if (candidates.length === 0) {
    result.errors.push(`No candidates: Reddit=${redditClips.length} YouTube=${youtubeClips.length}`)
    return result
  }

  // 2. Check which slugs already exist (stories + previously rejected)
  const slugsToCheck = candidates.map(c => makeSlug(c.platform, c.videoId, c.title))
  const [{ data: existing }, { data: rejectedSlugs }] = await Promise.all([
    supabase.from('stories').select('slug').in('slug', slugsToCheck),
    supabase.from('rejected_slugs').select('slug').in('slug', slugsToCheck),
  ])

  const existingSlugs = new Set([
    ...(existing ?? []).map((r: { slug: string }) => r.slug),
    ...(rejectedSlugs ?? []).map((r: { slug: string }) => r.slug),
  ])
  const newCandidates = candidates.filter(
    c => !existingSlugs.has(makeSlug(c.platform, c.videoId, c.title))
  )

  if (newCandidates.length === 0) {
    result.errors.push('All candidates already exist in database')
    return result
  }

  // 3. Process each new candidate
  for (const candidate of newCandidates.slice(0, 10)) { // cap at 10 per run (Vercel 10s timeout)
    try {
      // MSM gap check
      const msm = await checkMSMCoverage(candidate.title)
      await delay(200)

      // Claude verification
      const verification = await verifyAndTitle(
        {
          title: candidate.title,
          description: candidate.description,
          platform: candidate.platform,
          source: candidate.source,
          viralScore: candidate.viralScore,
          msmArticleCount: msm.articleCount,
          msmGap: msm.msmGap,
        },
        anthropicKey
      )
      await delay(100)

      const slug = makeSlug(candidate.platform, candidate.videoId, candidate.title)

      result.stories.push({
        title: verification.headline,
        slug,
        decision: verification.decision,
      })

      if (verification.decision === 'reject') {
        result.rejected++
        result.errors.push(`Rejected: "${candidate.title.slice(0, 50)}" — ${verification.rejectReason ?? 'no reason'}`)
        // Store slug so it's skipped on future runs
        await supabase.from('rejected_slugs').upsert({ slug, reason: verification.rejectReason ?? '' })
        continue
      }

      // Insert into Supabase as draft
      const { error } = await supabase.from('stories').insert({
        title: verification.headline,
        slug,
        description: verification.summary,
        embed_url: candidate.videoUrl,
        platform: candidate.platform,
        view_count: candidate.viralScore,
        share_count: 0,
        msm_gap: verification.msmGap,
        msm_notes: `Source: ${candidate.source} | Confidence: ${verification.confidence} | Status: ${verification.decision}`,
        published: false,
        display_order: 99,
      })

      if (error) {
        result.errors.push(`Failed to insert ${slug}: ${error.message}`)
        continue
      }

      if (verification.decision === 'needs_review') {
        result.needsReview++
      } else {
        result.inserted++
      }
    } catch (err) {
      result.errors.push(`Error processing candidate: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
