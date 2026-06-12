import { describe, it, expect, vi, beforeEach } from 'vitest'

// A channel that already has CHANNEL_DAILY_CAP published stories in the
// last 24h must have further candidates rejected (TTL'd) before any
// oEmbed, MSM, or Claude spend.
const checkMSMCoverage = vi.fn()
const verifyAndTitle = vi.fn()
const runQCAndInsert = vi.fn()
const tagStoryBySlug = vi.fn()
const pingIndexNow = vi.fn()

vi.mock('./msm-check', () => ({ checkMSMCoverage }))
vi.mock('./claude-verify', () => ({ verifyAndTitle }))
vi.mock('./qc-publish', () => ({ runQCAndInsert }))
vi.mock('./indexnow', () => ({ pingIndexNow }))
vi.mock('@/lib/story-taxonomy', () => ({ tagStoryBySlug }))
vi.mock('./youtube', () => ({ fetchYouTubeTrending: vi.fn(), resolveYouTubeChannelId: vi.fn() }))
vi.mock('./tiktok', () => ({ fetchTikTokTrending: vi.fn() }))
vi.mock('./global', () => ({ fetchGlobalClips: vi.fn() }))

const candidate = {
  slug: 'youtube-ajeclip6',
  title: 'Sixth Al Jazeera clip of the day',
  video_url: 'https://www.youtube.com/watch?v=ajeclip6',
  platform: 'youtube',
  video_id: 'ajeclip6',
  description: 'desc',
  viral_score: 1000,
  source: 'YouTube/Al Jazeera English',
  thumbnail_url: null,
  journalist_username: null,
  region: null,
  duration: null,
  uploaded_at: null,
  fetched_at: new Date().toISOString(),
  processed: false,
}

function buildSupabaseMock(todayStories: { title: string; source: string }[]) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn((table: string) => {
    if (table === 'candidates') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({ data: [candidate], error: null }),
            }),
          }),
        }),
        update: () => ({ eq: updateEq }),
      }
    }
    if (table === 'rejected_slugs') {
      return { upsert }
    }
    if (table === 'featured_journalists') {
      return { select: () => ({ not: () => Promise.resolve({ data: [] }) }) }
    }
    if (table === 'stories') {
      return {
        select: () => ({
          eq: () => ({ gte: () => Promise.resolve({ data: todayStories }) }),
        }),
      }
    }
    return { select: () => ({ }) }
  })
  return { from, upsert, updateEq }
}

describe('per-channel daily cap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('rejects a candidate from a channel that already hit the cap, before MSM/Claude calls', async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      title: `AJE story ${i}`,
      source: 'YouTube/Al Jazeera English',
    }))
    const supabaseMock = buildSupabaseMock(five)
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }))

    const { runProcess } = await import('./pipeline')
    const result = await runProcess(1)

    expect(result.rejected).toBe(1)
    expect(checkMSMCoverage).not.toHaveBeenCalled()
    expect(verifyAndTitle).not.toHaveBeenCalled()
    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'youtube-ajeclip6',
        reason: expect.stringContaining('channel_cap'),
        // volume-based rejection, not content-based — must expire so the
        // clip can re-enter tomorrow if still fresh
        expires_at: expect.any(String),
      })
    )
  })

  it('lets a candidate through when the channel is under the cap', async () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      title: `AJE story ${i}`,
      source: 'YouTube/Al Jazeera English',
    }))
    const supabaseMock = buildSupabaseMock(four)
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }))
    checkMSMCoverage.mockResolvedValue({ msmGap: false, articleCount: 0, coveredBy: [], notCoveredBy: [] })
    verifyAndTitle.mockResolvedValue({ decision: 'reject', rejectReason: 'test stops here', headline: 'x', summary: 'y' })

    const { runProcess } = await import('./pipeline')
    const result = await runProcess(1)

    expect(result.rejected).toBe(1) // rejected by the mocked verifier, not the cap
    expect(checkMSMCoverage).toHaveBeenCalled()
    expect(verifyAndTitle).toHaveBeenCalled()
  })
})
