import { describe, expect, it } from 'vitest'
import { HISTORY_SECTIONS, sectionForType } from './history'
import { formatActiveDuration } from './history'

describe('history sections', () => {
  it('maps event types to sections, reservoir_change → Weather & Water', () => {
    expect(sectionForType('road_closure')).toBe('roads')
    expect(sectionForType('coastal_flood')).toBe('weather')
    expect(sectionForType('reservoir_change')).toBe('weather')
    expect(sectionForType('fire_detection')).toBe('fire')
    expect(sectionForType('development_update')).toBe('development')
  })
  it('unknown types map to no section', () => {
    expect(sectionForType('mystery')).toBeUndefined()
  })
  it('has ordered unique section keys', () => {
    const keys = HISTORY_SECTIONS.map(s => s.key)
    expect(keys[0]).toBe('roads')
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('formatActiveDuration', () => {
  const start = '2026-09-28T12:00:00Z'
  it('minutes under an hour', () => {
    expect(formatActiveDuration(start, '2026-09-28T12:40:00Z')).toBe('active 40 min')
  })
  it('hours from 1h to under 48h', () => {
    expect(formatActiveDuration(start, '2026-09-28T15:00:00Z')).toBe('active 3h')
    expect(formatActiveDuration(start, '2026-09-29T23:00:00Z')).toBe('active 35h')
  })
  it('days from 48h on', () => {
    expect(formatActiveDuration(start, '2026-09-30T12:00:00Z')).toBe('active 2 days')
  })
  it('at-least prefix for time_sweep', () => {
    expect(formatActiveDuration(start, '2026-09-28T14:00:00Z', { atLeast: true })).toBe('active at least 2h')
  })
  it('undefined for missing/invalid/end-before-start', () => {
    expect(formatActiveDuration(undefined, start)).toBeUndefined()
    expect(formatActiveDuration(start, undefined)).toBeUndefined()
    expect(formatActiveDuration(start, 'nope')).toBeUndefined()
    expect(formatActiveDuration('2026-09-28T15:00:00Z', start)).toBeUndefined()
  })
})
