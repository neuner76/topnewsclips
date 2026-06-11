import { describe, it, expect, vi, beforeEach } from 'vitest'

// T-A3.1: an embed-blocked YouTube candidate must be rejected before any
// MSM lookup or Claude verification call — both are paid/rate-limited.
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
  slug: 'youtube-blocked123',
  title: 'A 30-day-old documentary about something',
  video_url: 'https://www.youtube.com/watch?v=blocked123',
  platform: 'youtube',
  video_id: 'blocked123',
  description: 'desc',
  viral_score: 1000,
  source: 'YouTube/Some Channel',
  thumbnail_url: null,
  journalist_username: null,
  region: null,
  duration: null,
  uploaded_at: null,
  fetched_at: new Date().toISOString(),
  processed: false,
}

function buildSupabaseMock() {
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
          eq: () => ({ gte: () => Promise.resolve({ data: [] }) }),
        }),
      }
    }
    return { select: () => ({ }) }
  })
  return { from, upsert, updateEq }
}

describe('A3: oEmbed check runs before MSM/Claude calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('rejects an embed-blocked candidate without calling MSM or Claude verification', async () => {
    const supabaseMock = buildSupabaseMock()
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => supabaseMock,
    }))

    const { runProcess } = await import('./pipeline')
    const result = await runProcess(1)

    expect(result.rejected).toBe(1)
    expect(checkMSMCoverage).not.toHaveBeenCalled()
    expect(verifyAndTitle).not.toHaveBeenCalled()
    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'youtube-blocked123', reason: 'youtube_embed_blocked' })
    )
  })
})
