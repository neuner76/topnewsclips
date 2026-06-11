import { describe, expect, it, vi } from 'vitest'

import { runQCAndInsert } from './qc-publish'

vi.mock('./qc-gate', () => ({
  runQCGate: vi.fn(async () => ({
    verdict: 'PASS',
    checks: [],
    routingNote: null,
  })),
}))

describe('runQCAndInsert', () => {
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
