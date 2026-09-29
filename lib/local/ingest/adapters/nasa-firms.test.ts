import { describe, expect, it } from 'vitest'
import { parseFirmsItems, firmsItemToCandidate, nasaFirmsAdapter } from './nasa-firms'

// Marin ~ 37.97,-122.53. Two pixels in the same ~1.4mi cell + one far away (LA) + one low-confidence.
const csv = [
  'latitude,longitude,confidence,acq_date',
  '38.045,-122.795,h,2026-09-29',   // West Marin, high conf
  '38.046,-122.796,n,2026-09-29',   // same ~1.4mi cell, nominal
  '34.050,-118.240,h,2026-09-29',   // LA — out of region
  '37.980,-122.540,l,2026-09-29',   // near, but low confidence → dropped
].join('\n')

describe('NASA FIRMS ingestion', () => {
  it('clusters confident in-region detections into one cell, drops low-conf + far', () => {
    const items = parseFirmsItems(csv)
    expect(items).toHaveLength(1)
    expect(items[0].extracted?.count).toBe(2) // two pixels merged
    expect(items[0].geo?.precision).toBe('place')
    expect(items[0].title).toContain('2 satellite fire detections')
  })
  it('candidate maps to fire_detection with a cell-keyed dedupeKey', () => {
    const cand = firmsItemToCandidate(parseFirmsItems(csv)[0])
    expect(cand.eventType).toBe('fire_detection')
    expect(cand.dedupeKey).toMatch(/^nasa-firms:/)
    expect(cand.geo?.precision).toBe('place')
    expect(cand.fields?.count).toBe(2)
  })
  it('a changed count yields a new content hash (→ event update)', () => {
    const a = parseFirmsItems(csv)[0]
    const csv2 = csv + '\n38.044,-122.794,h,2026-09-29' // third pixel, same cell
    const b = parseFirmsItems(csv2)[0]
    expect(b.extracted?.count).toBe(3)
    expect(a.contentHash).not.toBe(b.contentHash)
  })
  it('resolves by absence (rolling 24h window)', () => {
    expect(nasaFirmsAdapter.resolvesByAbsence).toBe(true)
  })
})
