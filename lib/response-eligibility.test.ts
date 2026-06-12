import { describe, expect, it } from 'vitest'

import { getResponseEligibility } from './response-eligibility'

const story = (title: string, description = '') => ({
  title,
  description,
  category: 'reported' as const,
  subcategory: null,
  region: null,
  source_type: 'Newsroom',
})

describe('response eligibility', () => {
  it('limits geopolitical conflict to learn, track, and responsible sharing', () => {
    const result = getResponseEligibility(story('US and Iran trade missile warnings after airstrike'))
    expect(result.storyCategory).toBe('geopolitical_conflict')
    expect(result.eligibility).toBe('learn_track_share_only')
    expect(result.allowedTypes).toEqual(['learn', 'track', 'share_responsibly'])
  })

  it('does not allow advocacy-style prompts for contested partisan politics', () => {
    const result = getResponseEligibility(story('Trump administration blocks release of Epstein files'))
    expect(result.storyCategory).toBe('contested_partisan_politics')
    expect(result.allowedTypes).not.toContain('support_verified_response')
    expect(result.allowedTypes).not.toContain('report')
  })

  it('allows official process links for public comment periods', () => {
    const result = getResponseEligibility(story('EPA opens public comment period on pollution rule'))
    expect(result.storyCategory).toBe('public_comment_period')
    expect(result.eligibility).toBe('full')
    expect(result.allowedTypes).toContain('official_process')
  })

  it('limits active violence and breaking crisis stories to learn and track', () => {
    const result = getResponseEligibility(story('Police order shelter in place after active shooter report'))
    expect(result.storyCategory).toBe('active_violence_breaking_crisis')
    expect(result.allowedTypes).toEqual(['learn', 'track'])
  })

  it('defaults unknown categories to learn and track only', () => {
    const result = getResponseEligibility(story('NASA scientist describes agency staffing cuts'))
    expect(result.storyCategory).toBe('other')
    expect(result.allowedTypes).toEqual(['learn', 'track'])
  })

  it('suppresses light culture and novelty stories', () => {
    const result = getResponseEligibility(story("Singapore Botanic Gardens opens Asia's first nature trail"))
    expect(result.storyCategory).toBe('culture_novelty_light')
    expect(result.eligibility).toBe('none')
  })
})
