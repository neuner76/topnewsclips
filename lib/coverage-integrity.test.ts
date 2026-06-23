import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import {
  flagSuspectCoverage,
  isHighSalienceDomestic,
  isGenuineBlindspotZero,
  reverifyCoverage,
  shouldReverifyCoverage,
  highSalienceCategory,
} from './coverage-integrity'

describe('high-salience predicate (Task 1)', () => {
  it('flags a domestic mass-casualty story as high-salience', () => {
    expect(isHighSalienceDomestic(fixtures.highSalienceDomesticZeroCoverage)).toBe(true)
    expect(highSalienceCategory(fixtures.highSalienceDomesticZeroCoverage)).toBe('mass_casualty')
  })

  it('does not flag an international story as high-salience domestic', () => {
    expect(isHighSalienceDomestic(fixtures.genuineInternationalBlindspotZero)).toBe(false)
  })

  it('does not flag an ordinary domestic story', () => {
    expect(isHighSalienceDomestic(fixtures.celebrityMusicUseDispute)).toBe(false)
  })
})

describe('flagSuspectCoverage (Task 1)', () => {
  it('marks a high-salience domestic 0-of-15 as suspect', () => {
    const integrity = flagSuspectCoverage(fixtures.highSalienceDomesticZeroCoverage)
    expect(integrity.confidence).toBe('suspect')
    expect(integrity.reason).toMatch(/implausibly low|clustering/i)
  })

  it('leaves a genuine international zero confirmed', () => {
    expect(flagSuspectCoverage(fixtures.genuineInternationalBlindspotZero).confidence).toBe('confirmed')
  })

  it('leaves a broadly covered story confirmed', () => {
    expect(flagSuspectCoverage(fixtures.corroboratedMajorStory).confidence).toBe('confirmed')
  })
})

describe('reverifyCoverage (Task 2)', () => {
  it('upgrades a suspect high-salience zero to confirmed when re-match finds coverage', async () => {
    const matcher = async () => ({ coveredBy: ['apnews.com', 'reuters.com', 'cnn.com', 'nbcnews.com', 'cbsnews.com', 'abcnews.go.com', 'foxnews.com', 'nytimes.com', 'usatoday.com'] })
    const integrity = await reverifyCoverage(fixtures.highSalienceDomesticZeroCoverage, matcher)
    expect(integrity.confidence).toBe('confirmed')
    expect(integrity.count).toBe(9)
  })

  it('keeps it suspect when re-match still finds (almost) nothing', async () => {
    const matcher = async () => ({ coveredBy: ['apnews.com'] }) // 1 < floor
    const integrity = await reverifyCoverage(fixtures.highSalienceDomesticZeroCoverage, matcher)
    expect(integrity.confidence).toBe('suspect')
  })

  it('does not re-verify a genuine international zero (not suspect)', async () => {
    let called = false
    const matcher = async () => { called = true; return { coveredBy: [] } }
    const integrity = await reverifyCoverage(fixtures.genuineInternationalBlindspotZero, matcher)
    expect(called).toBe(false)
    expect(integrity.confidence).toBe('confirmed')
  })

  it('holds suspect when the matcher throws', async () => {
    const matcher = async () => { throw new Error('network') }
    const integrity = await reverifyCoverage(fixtures.highSalienceDomesticZeroCoverage, matcher)
    expect(integrity.confidence).toBe('suspect')
  })
})

describe('shouldReverifyCoverage (broadened re-check trigger)', () => {
  it('re-checks a low-count hard-news international story (stale-zero candidate)', () => {
    expect(shouldReverifyCoverage(fixtures.staleInternationalHardNewsZero)).toBe(true)
  })

  it('re-checks a low-count high-salience domestic story (existing behavior)', () => {
    expect(shouldReverifyCoverage(fixtures.highSalienceDomesticZeroCoverage)).toBe(true)
  })

  it('does NOT re-check a role-less international zero (preserves genuine-blindspot path)', () => {
    expect(shouldReverifyCoverage(fixtures.genuineInternationalBlindspotZero)).toBe(false)
  })

  it('does NOT re-check an ordinary low-stakes story', () => {
    expect(shouldReverifyCoverage(fixtures.celebrityMusicUseDispute)).toBe(false)
  })

  it('does NOT re-check a broadly covered story', () => {
    expect(shouldReverifyCoverage(fixtures.corroboratedMajorStory)).toBe(false)
  })
})

describe('reverifyCoverage — broadened to hard-news international', () => {
  it('corrects a stale international hard-news zero when the re-check finds coverage', async () => {
    const matcher = async () => ({ coveredBy: ['nytimes.com', 'reuters.com', 'bbc.com', 'nbcnews.com', 'cbsnews.com', 'washingtonpost.com'] })
    const integrity = await reverifyCoverage(fixtures.staleInternationalHardNewsZero, matcher)
    expect(integrity.confidence).toBe('confirmed')
    expect(integrity.count).toBe(6)
  })

  it('confirms a genuine international hard-news zero (re-check finds nothing → stays a real blindspot, NOT suspect)', async () => {
    let called = false
    const matcher = async () => { called = true; return { coveredBy: [] } }
    const integrity = await reverifyCoverage(fixtures.genuineInternationalHardNewsZero, matcher)
    expect(called).toBe(true) // it IS re-checked now
    expect(integrity.confidence).toBe('confirmed') // but a confirmed zero, not suspect
    expect(integrity.count).toBe(0)
  })

  it('does not broaden flagSuspectCoverage — an international hard-news zero is still confirmed there (no regression to the 5 callers)', () => {
    expect(flagSuspectCoverage(fixtures.staleInternationalHardNewsZero).confidence).toBe('confirmed')
    expect(flagSuspectCoverage(fixtures.genuineInternationalHardNewsZero).confidence).toBe('confirmed')
  })
})

describe('isGenuineBlindspotZero (Task 3)', () => {
  it('accepts a confirmed international zero', () => {
    expect(isGenuineBlindspotZero(fixtures.genuineInternationalBlindspotZero)).toBe(true)
  })

  it('rejects a suspect domestic zero', () => {
    expect(isGenuineBlindspotZero(fixtures.highSalienceDomesticZeroCoverage)).toBe(false)
  })

  it('rejects a corroborated story (count > 0)', () => {
    expect(isGenuineBlindspotZero(fixtures.corroboratedMajorStory)).toBe(false)
  })

  it('still accepts a genuine international hard-news zero (blindspot preserved despite re-check broadening)', () => {
    expect(isGenuineBlindspotZero(fixtures.genuineInternationalHardNewsZero)).toBe(true)
  })
})
