import { describe, expect, it } from 'vitest'
import { mapHeldEvent, prettyTypeLabel, type HeldEventRow } from './review'

const row: HeldEventRow = {
  id: 'h1',
  headline: 'New 12-unit affordable apartment building',
  title: 'fallback title',
  event_type: 'development_update',
  importance: 40,
  verification_status: 'confirmed',
  geo_precision: 'address',
  publish_reason: 'event_type.auto_publish=false',
  first_detected_at: '2026-09-28T12:00:00Z',
  summary: '123 Grant Ave · $4,200,000',
}

describe('prettyTypeLabel', () => {
  it('humanizes spec slugs', () => {
    expect(prettyTypeLabel('development_update')).toBe('Development Update')
    expect(prettyTypeLabel('government_action')).toBe('Government Action')
  })
})

describe('mapHeldEvent', () => {
  it('maps to the review view model with app type + sources', () => {
    const v = mapHeldEvent(row, [{ label: 'Marin County permits', url: '/local/permit/h1' }])
    expect(v.headline).toBe('New 12-unit affordable apartment building')
    expect(v.appType).toBe('planning') // development_update → planning
    expect(v.typeLabel).toBe('Development Update')
    expect(v.importance).toBe(40)
    expect(v.publishReason).toContain('auto_publish=false')
    expect(v.sources[0].url).toBe('/local/permit/h1')
  })
  it('falls back to title when headline missing, defaults importance', () => {
    const v = mapHeldEvent({ ...row, headline: null, importance: null })
    expect(v.headline).toBe('fallback title')
    expect(v.importance).toBe(0)
    expect(v.sources).toEqual([])
  })
})
