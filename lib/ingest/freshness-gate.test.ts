import { describe, it, expect } from 'vitest'
import { isFresh, isSoftAnimalStory, preModelRejectReason, shouldGenerateMajorSections } from './pipeline'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('A3 freshness gate', () => {
  it('T-A3.2: rejects a 30-day-old documentary in trending', () => {
    expect(isFresh({ uploadedAt: daysAgo(30), journalistUsername: null, source: 'YouTube/VICE News' })).toBe(false)
  })

  it('T-A3.3: a 10-day-old satire clip passes (satire exemption)', () => {
    expect(isFresh({ uploadedAt: daysAgo(10), journalistUsername: 'lastweektonight', source: 'YouTube/LastWeekTonight' })).toBe(true)
  })

  it('rejects a 10-day-old non-satire clip', () => {
    expect(isFresh({ uploadedAt: daysAgo(10), journalistUsername: null, source: 'YouTube/Some Channel' })).toBe(false)
  })

  it('rejects a 20-day-old satire clip (past the 14-day satire window)', () => {
    expect(isFresh({ uploadedAt: daysAgo(20), journalistUsername: 'lastweektonight', source: 'YouTube/LastWeekTonight' })).toBe(false)
  })

  it('passes a candidate with no known upload date (TikTok/Global)', () => {
    expect(isFresh({ uploadedAt: null, journalistUsername: null, source: 'TikTok/@user' })).toBe(true)
  })

  it('passes a fresh same-day clip', () => {
    expect(isFresh({ uploadedAt: daysAgo(1), journalistUsername: null, source: 'YouTube/Some Channel' })).toBe(true)
  })
})

describe('soft animal story filter', () => {
  it('filters viral animal rescues with no public-interest angle', () => {
    expect(isSoftAnimalStory(
      "Farm owner rescues injured hawk, describes bird as 'scary' after regaining strength",
      'A farm owner posted a TikTok video documenting a hawk rescue on their property.'
    )).toBe(true)
  })

  it('keeps animal stories with a public-interest angle', () => {
    expect(isSoftAnimalStory(
      'Police investigate animal cruelty charges after injured dog rescue',
      'Officials said the case led to charges and a policy review.'
    )).toBe(false)
  })
})

describe('process cost gates', () => {
  it('rejects obvious soft entertainment before model verification', () => {
    expect(preModelRejectReason({
      title: 'BTS kicks off 2 concerts in Busan on Friday',
      description: 'The group will perform two concerts for fans.',
      source: 'YouTube/Entertainment Channel',
    })).toContain('pre_model_soft_entertainment')
  })

  it('rejects archival or retrospective material before model verification', () => {
    expect(preModelRejectReason({
      title: 'Comedian profile originally aired in 2025',
      description: 'From the archives, this profile looks back at the performer.',
      source: 'YouTube/Al Jazeera English',
    })).toContain('pre_model_archival')
  })

  it('narrows expensive major-story section generation to strong domestic institutional stories', () => {
    expect(shouldGenerateMajorSections({
      coverageCount: 7,
      candidateRegion: null,
      sourceTier: 1,
      sourceType: 'Investigative',
    })).toBe(true)

    expect(shouldGenerateMajorSections({
      coverageCount: 7,
      candidateRegion: 'Europe',
      sourceTier: 1,
      sourceType: 'Investigative',
    })).toBe(false)

    expect(shouldGenerateMajorSections({
      coverageCount: 7,
      candidateRegion: null,
      sourceTier: 8,
      sourceType: 'State-Affiliated Media',
    })).toBe(false)
  })
})
