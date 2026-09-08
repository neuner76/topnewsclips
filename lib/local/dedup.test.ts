import { describe, expect, it } from 'vitest'
import { mergeLocalEvents } from './dedup'
import type { LocalEvent } from './types'

const H = 3600_000
const ev = (id: string, type: LocalEvent['eventType'], lat: number, lng: number, firstAgoH: number, sourceLabel: string): LocalEvent => ({
  id, title: id, eventType: type, status: 'new',
  firstSeenAt: new Date(Date.now() - firstAgoH * H).toISOString(),
  latestUpdateAt: new Date(Date.now() - firstAgoH * H).toISOString(),
  geo: { latitude: lat, longitude: lng }, consequenceScore: 0, confidence: 'medium',
  sources: [{ type: 'local_news', label: sourceLabel, observedAt: '' }],
})

describe('mergeLocalEvents (Build A dedup: same type, <= 0.5 mi, <= 6 h)', () => {
  it('merges two same-type events within 0.5 mi and 6 h, unioning sources', () => {
    const a = ev('a', 'fire', 38.100, -122.570, 5, 'CalFire')
    const b = ev('b', 'fire', 38.1015, -122.5705, 2, 'Marin IJ') // ~0.1 mi, 3h apart
    const out = mergeLocalEvents([a, b])
    expect(out).toHaveLength(1)
    expect(out[0].sources.map(s => s.label).sort()).toEqual(['CalFire', 'Marin IJ'])
    expect(out[0].firstSeenAt).toBe(a.firstSeenAt) // keeps the earliest
  })
  it('does not merge different event types', () => {
    expect(mergeLocalEvents([ev('a', 'fire', 38.1, -122.57, 5, 'x'), ev('b', 'traffic', 38.1, -122.57, 5, 'y')])).toHaveLength(2)
  })
  it('does not merge points more than 0.5 mi apart', () => {
    expect(mergeLocalEvents([ev('a', 'fire', 38.10, -122.57, 5, 'x'), ev('b', 'fire', 38.20, -122.57, 5, 'y')])).toHaveLength(2)
  })
  it('does not merge events more than 6 h apart', () => {
    expect(mergeLocalEvents([ev('a', 'fire', 38.1, -122.57, 1, 'x'), ev('b', 'fire', 38.1, -122.57, 10, 'y')])).toHaveLength(2)
  })
})
