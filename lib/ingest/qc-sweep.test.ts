import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runQCSweep, isHighConfidenceFix } from './qc-sweep'

const { runQCGate } = vi.hoisted(() => ({ runQCGate: vi.fn() }))
vi.mock('./qc-gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./qc-gate')>()
  return { ...actual, runQCGate }
})

const baseStory = {
  id: 'id-pass',
  slug: 'pass-story',
  title: 'A clean story',
  description: 'A clean description.',
  source: 'YouTube/Some Channel',
  source_tier: 5,
  category: 'reported',
  msm_outlet_coverage: { covered: ['BBC', 'Reuters'], notCovered: [] },
  created_at: new Date().toISOString(),
}

function buildSupabaseMock(stories: Record<string, unknown>[]) {
  const updates: { table: string; id: string; payload: Record<string, unknown> }[] = []
  const sweepLogInserts: Record<string, unknown>[] = []

  function makeQuery() {
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.gte = vi.fn(() => query)
    query.then = (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data: stories, error: null })
    return query
  }

  const from = vi.fn((table: string) => {
    if (table === 'stories') {
      return {
        select: () => makeQuery(),
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updates.push({ table, id: String(id), payload })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }
    if (table === 'qc_sweep_log') {
      return {
        insert: (row: Record<string, unknown>) => {
          sweepLogInserts.push(row)
          return Promise.resolve({ error: null })
        },
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { from, updates, sweepLogInserts }
}

describe('isHighConfidenceFix', () => {
  it('is true only when every failed check is C1 or C2', () => {
    expect(isHighConfidenceFix([{ id: 'C1', result: 'fail', reason: 'x' }])).toBe(true)
    expect(isHighConfidenceFix([
      { id: 'C1', result: 'fail', reason: 'x' },
      { id: 'C2', result: 'fail', reason: 'y' },
    ])).toBe(true)
    expect(isHighConfidenceFix([{ id: 'C4', result: 'fail', reason: 'x' }])).toBe(false)
    expect(isHighConfidenceFix([
      { id: 'C1', result: 'fail', reason: 'x' },
      { id: 'C4', result: 'fail', reason: 'y' },
    ])).toBe(false)
    expect(isHighConfidenceFix([])).toBe(false)
  })
})

describe('runQCSweep', () => {
  beforeEach(() => {
    runQCGate.mockReset()
  })

  it('T-A2.1: dry run logs results without mutating stories', async () => {
    runQCGate.mockResolvedValue({
      storyId: 'pass-story',
      verdict: 'PASS',
      checks: [],
      revisedHeadline: null,
      revisedSummary: null,
      routingNote: null,
    })

    const supabaseMock = buildSupabaseMock([baseStory])
    const result = await runQCSweep({
      supabase: supabaseMock as never,
      anthropicKey: 'test-key',
      sinceDays: null,
      dryRun: true,
      source: 'backfill',
    })

    expect(result.scanned).toBe(1)
    expect(result.passed).toBe(1)
    expect(supabaseMock.updates).toHaveLength(0)
    expect(supabaseMock.sweepLogInserts).toHaveLength(1)
    expect(supabaseMock.sweepLogInserts[0]).toMatchObject({
      story_slug: 'pass-story',
      verdict: 'PASS',
      action: 'none',
      dry_run: true,
      source: 'backfill',
    })
  })

  it('T-A2.2: a high-confidence C1 FIX is auto-applied when not a dry run', async () => {
    runQCGate.mockResolvedValue({
      storyId: 'fix-story',
      verdict: 'FIX',
      checks: [{ id: 'C1', result: 'fail', reason: 'promo leak' }],
      revisedHeadline: 'Cleaned headline',
      revisedSummary: 'Cleaned summary',
      routingNote: null,
    })

    const story = { ...baseStory, id: 'id-fix', slug: 'fix-story' }
    const supabaseMock = buildSupabaseMock([story])
    const result = await runQCSweep({
      supabase: supabaseMock as never,
      anthropicKey: 'test-key',
      sinceDays: 14,
      dryRun: false,
      source: 'nightly_sweep',
    })

    expect(result.autoFixed).toBe(1)
    expect(result.held).toBe(0)
    expect(supabaseMock.updates).toHaveLength(1)
    expect(supabaseMock.updates[0]).toMatchObject({
      table: 'stories',
      id: 'id-fix',
      payload: expect.objectContaining({
        title: 'Cleaned headline',
        description: 'Cleaned summary',
        qc_status: 'pass',
      }),
    })
    expect(supabaseMock.sweepLogInserts[0]).toMatchObject({ action: 'auto_fix', dry_run: false })
  })

  it('T-A2.3: a HOLD verdict unpublishes the story and routes it to the hold queue', async () => {
    runQCGate.mockResolvedValue({
      storyId: 'hold-story',
      verdict: 'HOLD',
      checks: [{ id: 'C4', result: 'fail', reason: 'stale/retrospective content' }],
      revisedHeadline: null,
      revisedSummary: null,
      routingNote: 'Move to archive section',
    })

    const story = { ...baseStory, id: 'id-hold', slug: 'hold-story' }
    const supabaseMock = buildSupabaseMock([story])
    const result = await runQCSweep({
      supabase: supabaseMock as never,
      anthropicKey: 'test-key',
      sinceDays: 14,
      dryRun: false,
      source: 'nightly_sweep',
    })

    expect(result.held).toBe(1)
    expect(supabaseMock.updates).toHaveLength(1)
    expect(supabaseMock.updates[0]).toMatchObject({
      table: 'stories',
      id: 'id-hold',
      payload: expect.objectContaining({
        published: false,
        qc_status: 'hold',
        qc_routing_note: 'Move to archive section',
      }),
    })
    expect(supabaseMock.sweepLogInserts[0]).toMatchObject({ action: 'hold', dry_run: false })
  })
})
