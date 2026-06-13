import { describe, expect, it } from 'vitest'
import type { Story } from './types'
import {
  clampWords,
  displaySummary,
  emergingSignalCopy,
  globalLensDisplayText,
  isLimitedSourceNeedToKnow,
  isWeakPrimarySingleton,
  isZeroCoverageStory,
  shouldShowZeroCoverageCaution,
  stripSourceBoilerplate,
  validateGlobalLensSourceConsistency,
} from './feed-editorial'

const story = (overrides: Partial<Story> = {}): Story => ({
  id: '1',
  title: 'NASA JPL staffing cuts raise concerns',
  slug: 'nasa-jpl',
  description: 'Scientists described effects of the cuts.',
  embed_url: 'https://example.com',
  platform: 'youtube',
  view_count: 0,
  share_count: 0,
  msm_gap: true,
  msm_notes: null,
  msm_outlet_coverage: { covered: [], notCovered: Array.from({ length: 15 }, (_, i) => `Outlet ${i}`) },
  published: true,
  display_order: 50,
  category: 'reported',
  subcategory: null,
  thumbnail_url: null,
  journalist_username: 'democracynow',
  source: 'YouTube/Democracy Now!',
  region: null,
  source_tier: 4,
  source_type: 'Independent News',
  pinned: false,
  duration: null,
  created_at: '2026-06-12T12:00:00.000Z',
  updated_at: '2026-06-12T12:00:00.000Z',
  verified_interpretation: null,
  qc_status: 'pass',
  qc_failed_checks: null,
  qc_routing_note: null,
  ...overrides,
})

describe('feed editorial hierarchy', () => {
  it('marks any 0-of-15 Need To Know story as an emerging signal', () => {
    expect(isLimitedSourceNeedToKnow(story(), 'Need To Know')).toBe(true)
  })

  it('uses lead-specific and non-lead emerging signal copy', () => {
    expect(emergingSignalCopy(0)).toContain('This story leads')
    expect(emergingSignalCopy(1)).toBe('This story may be important and undercovered. Details may develop.')
  })

  it('detects zero coverage and primary-section caution without duplicating blindspot labels', () => {
    const zero = story()
    expect(isZeroCoverageStory(zero)).toBe(true)
    expect(shouldShowZeroCoverageCaution('Science & Technology', zero)).toBe(true)
    expect(shouldShowZeroCoverageCaution('Global Blindspot', zero)).toBe(false)
  })

  it('treats weak singleton primary-section stories as reassignment candidates', () => {
    expect(isWeakPrimarySingleton(story())).toBe(true)
    expect(isWeakPrimarySingleton(story({ pinned: true }))).toBe(false)
  })

  it('fails Global Lens validation when summary names a different outlet', () => {
    const result = validateGlobalLensSourceConsistency(
      { summary: 'Al Jazeera centers civilian casualties rather than Washington politics.' },
      { source: 'YouTube/DW News', journalist_username: 'dwnews' }
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('al jazeera')
  })

  it('clamps Global Lens and Blindspot display text', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    expect(clampWords(long, 65).split(/\s+/)).toHaveLength(65)
    expect(clampWords(long, 65)).toContain('...')
    expect(globalLensDisplayText('DW News centers European security. A second sentence repeats the same point.')).toBe('DW News centers European security.')
  })

  it('strips platform and source boilerplate from display summaries', () => {
    expect(stripSourceBoilerplate('Watch this story on YouTube. Officials announced a probe.')).toBe('Officials announced a probe.')
    expect(displaySummary('Follow us on TikTok. Workers announced a strike.', 10)).toBe('Workers announced a strike.')
  })
})
