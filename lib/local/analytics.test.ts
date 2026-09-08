import { describe, expect, it } from 'vitest'
import { LOCAL_ANALYTICS_EVENTS, relevanceBand, localEventProps } from './analytics'
import { hasCoordinateLeak } from './privacy'
import type { LocalEvent } from './types'

const event: LocalEvent = {
  id: 'e', title: 't', eventType: 'fire', status: 'new',
  firstSeenAt: '', latestUpdateAt: '',
  geo: { latitude: 38.1077, longitude: -122.5697 }, // has coords — must NOT leak
  consequenceScore: 0.8, relevanceScore: 0.9, confidence: 'high',
  sources: [{ type: 'official_alert', label: 'Marin County Fire', observedAt: '' }],
}

describe('local analytics', () => {
  it('exposes the spec event names', () => {
    expect(LOCAL_ANALYTICS_EVENTS.digestViewed).toBe('local_digest_viewed')
    expect(LOCAL_ANALYTICS_EVENTS.eventClicked).toBe('local_event_clicked')
    expect(LOCAL_ANALYTICS_EVENTS.blindspotClicked).toBe('local_blindspot_clicked')
  })

  it('bins relevance', () => {
    expect(relevanceBand(0.9)).toBe('high')
    expect(relevanceBand(0.5)).toBe('medium')
    expect(relevanceBand(0.1)).toBe('low')
  })

  it('builds privacy-safe properties with bands and NO coordinates', () => {
    const props = localEventProps(event, 'needToKnow', { distanceMiles: 2 })
    expect(props.section).toBe('needToKnow')
    expect(props.eventType).toBe('fire')
    expect(props.distanceBand).toBe('1–3 mi')
    expect(props.relevanceBand).toBe('high')
    expect(props.confidence).toBe('high')
    expect(props.sourceType).toBe('official_alert')
    expect(hasCoordinateLeak(props)).toBe(false)
  })
})
