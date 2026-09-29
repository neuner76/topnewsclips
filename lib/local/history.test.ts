import { describe, expect, it } from 'vitest'
import { HISTORY_SECTIONS, sectionForType } from './history'
import { formatActiveDuration } from './history'
import { formatPacificTime } from './history'
import { inferResolutionKind } from './history'
import { formatResolution } from './history'
import { verificationLabel } from './history'
import { extractRoadName, isRoutineClosure } from './history'
import { formatRoutineSummary } from './history'

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

describe('formatPacificTime (America/Los_Angeles)', () => {
  const now = new Date('2026-09-29T20:00:00Z') // 1:00 PM PDT
  it('within 24h shows time only, in Pacific', () => {
    // 2026-09-29T19:40Z = 12:40 PM PDT
    expect(formatPacificTime('2026-09-29T19:40:00Z', now)).toBe('12:40 PM')
  })
  it('older than 24h shows date + time', () => {
    // 2026-09-24T22:40Z = 3:40 PM PDT
    expect(formatPacificTime('2026-09-24T22:40:00Z', now)).toBe('Sep 24, 3:40 PM')
  })
  it('handles a winter (PST) instant across DST', () => {
    const winterNow = new Date('2026-01-15T20:00:00Z')
    // 2026-01-15T19:40Z = 11:40 AM PST
    expect(formatPacificTime('2026-01-15T19:40:00Z', winterNow)).toBe('11:40 AM')
  })
})

describe('inferResolutionKind', () => {
  it('explicit reason wins', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T12:00:00Z', latestUpdateAt: '2026-09-28T11:59:00Z', reason: 'time_sweep' })).toBe('time_sweep')
    expect(inferResolutionKind({ reason: 'explicit_end' })).toBe('explicit_end')
  })
  it('60-minute gap between latest update and resolved → time_sweep', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T13:30:00Z', latestUpdateAt: '2026-09-28T12:00:00Z' })).toBe('time_sweep')
  })
  it('small gap defaults to feed_absent', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T12:10:00Z', latestUpdateAt: '2026-09-28T12:00:00Z' })).toBe('feed_absent')
    expect(inferResolutionKind({})).toBe('feed_absent')
  })
})

describe('formatResolution', () => {
  const now = new Date('2026-09-29T20:00:00Z')
  it('feed_absent → cleared ~time', () => {
    expect(formatResolution('feed_absent', '2026-09-29T19:40:00Z', undefined, now)).toBe('cleared ~12:40 PM')
  })
  it('explicit_end → ended time', () => {
    expect(formatResolution('explicit_end', '2026-09-29T19:40:00Z', undefined, now)).toBe('ended 12:40 PM')
  })
  it('time_sweep → no updates after latest_update time', () => {
    expect(formatResolution('time_sweep', '2026-09-29T19:40:00Z', '2026-09-29T18:40:00Z', now)).toBe('no updates after 11:40 AM')
  })
})

describe('verificationLabel (from verification_status)', () => {
  it('maps the four statuses', () => {
    expect(verificationLabel('confirmed')).toBe('Confirmed')
    expect(verificationLabel('developing')).toBe('Developing')
    expect(verificationLabel('community_reports')).toBe('Community reports')
    expect(verificationLabel('unverified')).toBe('Unverified')
  })
  it('defaults null/unknown to Unverified', () => {
    expect(verificationLabel(null)).toBe('Unverified')
    expect(verificationLabel('weird')).toBe('Unverified')
  })
})

describe('extractRoadName', () => {
  it('pulls the route token from the title', () => {
    expect(extractRoadName('US-101 South — Lane closure near Novato')).toBe('US-101')
    expect(extractRoadName('SR-1 North / South — Lane closure near Marshall')).toBe('SR-1')
  })
  it('falls back to the whole leading phrase when no route pattern', () => {
    expect(extractRoadName('Sir Francis Drake Blvd — Lane closure')).toBe('Sir Francis Drake Blvd')
  })
})

describe('isRoutineClosure (spec §5)', () => {
  const base = { specEventType: 'road_closure', title: 'US-101 South — Lane closure near Novato', summary: 'AC Paving/Overlay', startedAt: '2026-09-28T00:00:00Z', resolvedAt: '2026-09-28T06:00:00Z' }
  it('a planned partial US-101 lane closure is routine', () => {
    expect(isRoutineClosure(base)).toBe(true)
  })
  it('full closures are NOT routine', () => {
    expect(isRoutineClosure({ ...base, title: 'US-101 South — Full closure near Mill Valley' })).toBe(false)
  })
  it('road_incident is never routine', () => {
    expect(isRoutineClosure({ ...base, specEventType: 'road_incident' })).toBe(false)
  })
  it('emergency work is NOT routine', () => {
    expect(isRoutineClosure({ ...base, summary: 'Emergency slide repair' })).toBe(false)
  })
  it('a long closure (≥12h) on an exempt road is NOT routine', () => {
    expect(isRoutineClosure({ ...base, title: 'SR-1 North — Lane closure near Marshall', resolvedAt: '2026-09-28T18:00:00Z' })).toBe(false)
  })
  it('a short closure on an exempt road IS routine', () => {
    expect(isRoutineClosure({ ...base, title: 'SR-1 North — Lane closure near Marshall', resolvedAt: '2026-09-28T04:00:00Z' })).toBe(true)
  })
})

describe('formatRoutineSummary (spec §5)', () => {
  it('undefined when count is zero', () => {
    expect(formatRoutineSummary(0, [])).toBeUndefined()
  })
  it('no "mostly" clause under 3', () => {
    expect(formatRoutineSummary(2, ['US-101'])).toBe('Plus 2 planned lane closures.')
    expect(formatRoutineSummary(1, ['US-101'])).toBe('Plus 1 planned lane closure.')
  })
  it('adds "mostly" with the top 2 roads at 3+', () => {
    expect(formatRoutineSummary(9, ['US-101', 'SR-1', 'I-580'])).toBe('Plus 9 planned lane closures, mostly US-101, SR-1.')
  })
})
