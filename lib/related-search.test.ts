import { describe, expect, it } from 'vitest'

import { getRelatedSearchQuery } from './related-search'

describe('related search query', () => {
  it('uses a broad geopolitical issue term instead of the full headline', () => {
    expect(getRelatedSearchQuery({
      title: 'SpaceX IPO launches on NASDAQ amid volatile markets tied to Iran tensions',
      description: 'Markets moved as investors watched US-Iran war uncertainty.',
      region: null,
      source: 'ABC Australia',
      journalist_username: 'abcnewsaustralia',
    }, 'geopolitical_conflict')).toBe('iran')
  })

  it('falls back to a short keyword query for ordinary stories', () => {
    expect(getRelatedSearchQuery({
      title: 'NASA JPL gutted by staffing cuts',
      description: 'A former scientist described staffing reductions.',
      region: null,
      source: 'Democracy Now',
      journalist_username: 'democracynow',
    }, 'other')).toBe('nasa gutted')
  })
})
