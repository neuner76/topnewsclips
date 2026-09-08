import { describe, expect, it } from 'vitest'
import { deriveEventStatus } from './lifecycle'
import type { LocalEvent } from './types'

const H = 3600_000
const ev = (firstAgoH: number, updAgoH: number, extra: Partial<LocalEvent> = {}): LocalEvent => ({
  id: 'e', title: 't', eventType: 'fire', status: 'new',
  firstSeenAt: new Date(Date.now() - firstAgoH * H).toISOString(),
  latestUpdateAt: new Date(Date.now() - updAgoH * H).toISOString(),
  geo: {}, consequenceScore: 0, confidence: 'medium', sources: [], ...extra,
})

describe('deriveEventStatus', () => {
  it('new: first seen < 24h, single source', () => {
    expect(deriveEventStatus(ev(2, 2))).toBe('new')
  })
  it('developing: updated within 24h with 2+ sources', () => {
    expect(deriveEventStatus(ev(2, 1, { sources: [{ type: 'local_news', label: 'a', observedAt: '' }, { type: 'sensor', label: 'b', observedAt: '' }] }))).toBe('developing')
  })
  it('developing: updated within 24h with an official update', () => {
    expect(deriveEventStatus(ev(2, 1, { sources: [{ type: 'official_alert', label: 'gov', observedAt: '' }] }))).toBe('developing')
  })
  it('ongoing: last update > 24h ago, not yet resolved', () => {
    expect(deriveEventStatus(ev(48, 30))).toBe('ongoing')
  })
  it('resolved: 7+ days without an update (non-planning)', () => {
    expect(deriveEventStatus(ev(200, 8 * 24))).toBe('resolved')
  })
  it('planning/government types resolve at 14 days, not 7', () => {
    expect(deriveEventStatus(ev(300, 8 * 24, { eventType: 'planning' }))).toBe('ongoing')
    expect(deriveEventStatus(ev(400, 15 * 24, { eventType: 'planning' }))).toBe('resolved')
  })
})
