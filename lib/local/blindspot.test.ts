import { describe, expect, it } from 'vitest'
import { localMediaCoverageScore, selectLocalBlindspots } from './blindspot'
import type { LocalEvent } from './types'

const rec = (id: string, consequence: number, over: Partial<LocalEvent> = {}): LocalEvent => ({
  id, title: id, eventType: 'contract', status: 'new',
  firstSeenAt: '2026-09-08T00:00:00Z', latestUpdateAt: '2026-09-08T00:00:00Z',
  geo: { counties: ['Marin County'] }, consequenceScore: consequence, confidence: 'high',
  sources: [{ type: 'public_record', label: 'Marin County', url: 'https://x', observedAt: '' }], ...over,
})

describe('localMediaCoverageScore', () => {
  it('is matchedOutlets/3 capped at 1', () => {
    expect(localMediaCoverageScore(0)).toBe(0)
    expect(localMediaCoverageScore(1)).toBeCloseTo(1 / 3, 5)
    expect(localMediaCoverageScore(3)).toBe(1)
    expect(localMediaCoverageScore(9)).toBe(1)
  })
})

describe('selectLocalBlindspots', () => {
  it('ranks consequential, uncovered records highest', () => {
    const out = selectLocalBlindspots([
      { event: rec('big', 0.9), localMediaOutlets: 0 },
      { event: rec('small', 0.2), localMediaOutlets: 0 },
    ])
    expect(out[0].event.id).toBe('big')
  })

  it('penalizes covered records (a well-covered story is not a blindspot)', () => {
    const uncovered = selectLocalBlindspots([{ event: rec('a', 0.8), localMediaOutlets: 0 }])[0].score
    const covered = selectLocalBlindspots([{ event: rec('a', 0.8), localMediaOutlets: 3 }], { minScore: 0 })
    expect(covered[0]?.score ?? 0).toBeLessThan(uncovered)
  })

  it('requires a primary (public_record / official_alert) source', () => {
    const noPrimary = rec('x', 0.9, { sources: [{ type: 'local_news', label: 'blog', observedAt: '' }] })
    expect(selectLocalBlindspots([{ event: noPrimary, localMediaOutlets: 0 }])).toHaveLength(0)
  })

  it('drops records below the consequence threshold and respects the limit', () => {
    const inputs = [rec('a', 0.9), rec('b', 0.8), rec('c', 0.05)].map(event => ({ event, localMediaOutlets: 0 }))
    const out = selectLocalBlindspots(inputs, { limit: 5 })
    expect(out.map(b => b.event.id)).toEqual(['a', 'b']) // c below threshold
    expect(selectLocalBlindspots(inputs, { limit: 1 })).toHaveLength(1)
  })

  it('reports the outlet count for display', () => {
    expect(selectLocalBlindspots([{ event: rec('a', 0.9), localMediaOutlets: 0 }])[0].localMediaOutlets).toBe(0)
  })
})
