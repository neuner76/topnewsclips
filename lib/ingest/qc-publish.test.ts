import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runQCAndInsert } from './qc-publish'
import { runQCGate } from './qc-gate'

vi.mock('./qc-gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./qc-gate')>()
  return {
    ...actual,
    runQCGate: vi.fn(async () => ({
      verdict: 'PASS',
      checks: [],
      routingNote: null,
    })),
  }
})

const runQCGateMock = vi.mocked(runQCGate)

const baseQC = {
  section: 'reported',
  contentType: 'reported',
  confidenceLabel: 'Reported',
  sourceName: 'Test Source',
  sourceTier: 6,
  coverageCount: 0,
  rawSourceDescription: '',
} as const

function mockSupabase() {
  const storyInserts: Record<string, unknown>[] = []
  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (row: Record<string, unknown>) => {
        if (table === 'stories') storyInserts.push(row)
        return { error: null }
      }),
    })),
  }
  return { supabase, storyInserts }
}

describe('runQCAndInsert', () => {
  beforeEach(() => {
    runQCGateMock.mockReset()
    runQCGateMock.mockResolvedValue({
      storyId: 'x',
      verdict: 'PASS',
      checks: [],
      revisedHeadline: null,
      revisedSummary: null,
      routingNote: null,
    })
  })

  it('publishes with the revision applied when only copy-quality checks (C3/C5/C7/C8) still fail', async () => {
    runQCGateMock
      .mockResolvedValueOnce({
        storyId: 'x',
        verdict: 'FIX',
        checks: [{ id: 'C5', result: 'fail', reason: 'unattributed claim' }],
        revisedHeadline: 'Revised headline',
        revisedSummary: 'Revised summary, per Source.',
        routingNote: null,
      })
      .mockResolvedValueOnce({
        storyId: 'x',
        verdict: 'FIX',
        checks: [{ id: 'C3', result: 'fail', reason: 'final sentence is filler' }],
        revisedHeadline: null,
        revisedSummary: 'Tighter revised summary, per Source.',
        routingNote: null,
      })

    const { supabase, storyInserts } = mockSupabase()
    const result = await runQCAndInsert(
      supabase as never,
      'test-key',
      { slug: 'youtube-quality-nit', title: 'Original headline', description: 'Original summary' },
      baseQC
    )

    expect(result).toEqual({ inserted: true, held: false, error: undefined })
    expect(storyInserts).toHaveLength(1)
    expect(storyInserts[0]).toMatchObject({
      title: 'Revised headline',
      description: 'Tighter revised summary, per Source.',
      qc_status: 'pass',
      qc_failed_checks: [{ id: 'C3', result: 'fail', reason: 'final sentence is filler' }],
    })
    expect(storyInserts[0].published).toBeUndefined()
  })

  it('still holds when a trust-critical check (C1/C2/C4/C6) fails after the revision cycle', async () => {
    runQCGateMock
      .mockResolvedValueOnce({
        storyId: 'x',
        verdict: 'FIX',
        checks: [{ id: 'C4', result: 'fail', reason: 'archival content in daily section' }],
        revisedHeadline: 'Revised headline',
        revisedSummary: 'Revised summary',
        routingNote: 'move to retrospective section',
      })
      .mockResolvedValueOnce({
        storyId: 'x',
        verdict: 'HOLD',
        checks: [{ id: 'C4', result: 'fail', reason: 'still archival' }],
        revisedHeadline: null,
        revisedSummary: null,
        routingNote: 'move to retrospective section',
      })

    const { supabase, storyInserts } = mockSupabase()
    const result = await runQCAndInsert(
      supabase as never,
      'test-key',
      { slug: 'youtube-archival', title: 'Original headline', description: 'Original summary' },
      baseQC
    )

    expect(result).toEqual({ inserted: true, held: true, error: undefined })
    expect(storyInserts).toHaveLength(1)
    expect(storyInserts[0]).toMatchObject({ published: false, qc_status: 'hold' })
  })

  it('holds static trust failures without calling the model QC gate', async () => {
    const { supabase, storyInserts } = mockSupabase()
    const result = await runQCAndInsert(
      supabase as never,
      'test-key',
      {
        slug: 'youtube-archival-static',
        title: 'Archival documentary resurfaces',
        description: 'A documentary looks back at the history of the dispute.',
      },
      {
        ...baseQC,
        section: 'reported',
        rawSourceDescription: 'From the archives: this documentary originally aired in 2018.',
      }
    )

    expect(runQCGateMock).not.toHaveBeenCalled()
    expect(result).toEqual({ inserted: true, held: true, error: undefined })
    expect(storyInserts).toHaveLength(1)
    expect(storyInserts[0]).toMatchObject({
      published: false,
      qc_status: 'hold',
      qc_routing_note: 'Static QC hold before model gate.',
    })
  })

  it('treats duplicate story slugs as already handled', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "stories_slug_key"',
        },
      })

    const supabase = {
      from: vi.fn((table: string) => ({
        insert: table === 'qc_log' ? insert : insert,
      })),
    }

    const result = await runQCAndInsert(
      supabase as never,
      'test-key',
      {
        slug: 'youtube-existing',
        title: 'Existing story',
        description: 'Existing description',
      },
      {
        section: 'reported',
        contentType: 'reported',
        confidenceLabel: 'Reported',
        sourceName: 'Test Source',
        sourceTier: 6,
        coverageCount: 0,
        rawSourceDescription: '',
      }
    )

    expect(result).toEqual({ inserted: false, held: false, duplicate: true })
  })
})
