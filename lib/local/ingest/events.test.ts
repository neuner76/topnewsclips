import { describe, expect, it } from 'vitest'
import { hasRequiredFields } from './events'
import type { EventCandidate } from './types'

const base: EventCandidate = {
  eventType: 'weather_alert',
  headline: 'Coastal Flood Advisory',
  startedAt: '2026-09-28T12:00:00Z',
}

describe('hasRequiredFields (§10)', () => {
  it('passes with headline + type + startedAt + county-or-better geo', () => {
    expect(hasRequiredFields(base, 'county')).toBe(true)
    expect(hasRequiredFields(base, 'exact')).toBe(true)
  })
  it('fails on unknown geo (not mappable yet)', () => {
    expect(hasRequiredFields(base, 'unknown')).toBe(false)
  })
  it('fails when headline / startedAt missing', () => {
    expect(hasRequiredFields({ ...base, headline: undefined }, 'county')).toBe(false)
    expect(hasRequiredFields({ ...base, startedAt: undefined }, 'county')).toBe(false)
  })
  it('enforces event_type extra required fields', () => {
    expect(hasRequiredFields(base, 'county', ['customers'])).toBe(false)
    expect(hasRequiredFields({ ...base, fields: { customers: 1200 } }, 'county', ['customers'])).toBe(true)
    expect(hasRequiredFields({ ...base, fields: { customers: '' } }, 'county', ['customers'])).toBe(false)
  })
})
