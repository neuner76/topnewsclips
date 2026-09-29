import { describe, expect, it } from 'vitest'
import { HISTORY_SECTIONS, sectionForType } from './history'

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
