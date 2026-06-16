import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import {
  flagSuspectCoverage,
  isHighSalienceDomestic,
  isGenuineBlindspotZero,
  reverifyCoverage,
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
})
