import { describe, expect, it } from 'vitest'
import { detectLocalCoverage, articleCoversEvent } from './coverage'
import type { LocalEvent } from './types'
import type { LocalArticle } from './adapters/local-news'

const permit: LocalEvent = {
  id: 'p', title: '26-unit residential building', eventType: 'building_permit', status: 'new',
  firstSeenAt: '2026-09-08T00:00:00Z', latestUpdateAt: '2026-09-08T00:00:00Z',
  geo: { counties: ['Marin County'] }, consequenceScore: 0.9, confidence: 'high',
  sources: [{ type: 'public_record', label: 'Marin County permits', observedAt: '' }],
  whatChanged: 'Permit received · valuation $4,000,000 · 100 Main St, Novato',
}

const art = (outlet: string, title: string, description: string, publishedAt = '2026-09-09T00:00:00Z'): LocalArticle =>
  ({ outlet, title, description, url: 'https://x', publishedAt })

describe('articleCoversEvent', () => {
  it('matches on 2+ signals (entity + address + dollar)', () => {
    expect(articleCoversEvent(permit, art('Marin IJ', 'Novato approves 26-unit residential project on Main St', 'The $4 million development at 100 Main Street cleared review.'))).toBe(true)
  })

  it('does not match on a single weak signal', () => {
    expect(articleCoversEvent(permit, art('KQED', 'Bay Area housing trends', 'A regional overview of the market.'))).toBe(false)
  })
})

describe('detectLocalCoverage', () => {
  it('counts distinct covering outlets within the ±7-day window', () => {
    const arts = [
      art('Marin IJ', 'Novato approves 26-unit residential project on Main St', '$4 million at 100 Main Street'),
      art('Point Reyes Light', '26-unit residential building approved at 100 Main', 'valued at $4,000,000'),
      art('Marin IJ', 'Same story reprinted', '100 Main St $4 million 26-unit residential'), // same outlet, not double-counted
    ]
    expect(detectLocalCoverage(permit, arts)).toBe(2)
  })

  it('ignores articles outside the time window', () => {
    const stale = art('Marin IJ', 'Novato 26-unit residential 100 Main', '$4,000,000', '2026-08-01T00:00:00Z')
    expect(detectLocalCoverage(permit, [stale])).toBe(0)
  })

  it('returns 0 when nothing covers the record (the blindspot case)', () => {
    expect(detectLocalCoverage(permit, [art('KQED', 'Unrelated wildfire coverage', 'Somewhere else entirely')])).toBe(0)
  })
})
