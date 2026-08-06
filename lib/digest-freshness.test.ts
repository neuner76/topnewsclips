import { describe, expect, it } from 'vitest'
import { needToKnowFreshness, SECONDARY_SECTION_MAX_AGE_HOURS } from './digest-freshness'

// Hard freshness rule for Need To Know: a card whose newest referenced event is
// older than 72h must carry a fresh-development signal (a within-window date or
// a today-class marker), or it is stale and excluded from Need To Know. Global
// Blindspot is exempt (late international coverage is the point) — this gate is
// applied only to the Need To Know list by the caller.
const EDITION = new Date('2026-07-12T12:00:00Z')

describe('needToKnowFreshness', () => {
  const fresh = (text: string) => needToKnowFreshness(text, EDITION).fresh

  it('flags the stale LA warehouse-fire card (June 22 event, no fresh development)', () => {
    const text =
      'A warehouse fire in Los Angeles had continued burning for six days as of a CBS News report filed around June 22, 2026, with firefighters still actively battling the blaze.'
    expect(fresh(text)).toBe(false)
  })

  it('flags an explicitly retrospective card ("more than two weeks ago")', () => {
    expect(fresh('In reporting from more than two weeks ago, ThePrint covered a major fire.')).toBe(false)
  })

  it('keeps a current breaking story with no old date', () => {
    expect(fresh('Senator Lindsey Graham died at 71 from a brief sudden illness, staff said.')).toBe(true)
  })

  it('keeps a story whose newest date is within 72h of the edition', () => {
    expect(fresh('Congress passed the largest housing bill in decades on July 11, 2026.')).toBe(true)
  })

  it('keeps an old event that shows a fresh development today', () => {
    const text =
      'The warehouse fire that began June 22 spread to two new blocks today, forcing fresh evacuations, CBS News reports.'
    expect(fresh(text)).toBe(true)
  })

  it('keeps a story that only cites an old date for context but is anchored today', () => {
    expect(fresh('The ceasefire signed in October 2025 collapsed today as strikes resumed.')).toBe(true)
  })

  it('reports a reason when it flags a card', () => {
    const r = needToKnowFreshness('A report filed around June 22, 2026 documents an ongoing fire.', EDITION)
    expect(r.fresh).toBe(false)
    expect(r.reason).toBeTruthy()
  })
})

describe('needToKnowFreshness — evergreen / retrospective compilations', () => {
  // Nostalgia reels (SNL retrospectives, "best of" compilations) carry no date,
  // so the date-based freshness checks missed them. They are not news and must
  // be excluded from every section regardless of when the clip was uploaded.
  it('flags an SNL retrospective compilation', () => {
    const text = 'SNL\'s Mister Robinson: A Retrospective Compilation of Recurring Sketches. In a retrospective compilation of past highlights, Saturday Night Live revisits its recurring Mister Robinson character across multiple installments.'
    expect(needToKnowFreshness(text, EDITION).fresh).toBe(false)
  })

  it('evergreen language overrides a fresh marker (uploaded today ≠ news)', () => {
    expect(needToKnowFreshness('Released today: a best-of compilation of the show\'s greatest hits over the years.', EDITION).fresh).toBe(false)
  })

  it('does NOT flag legitimate news that merely contains "retrospective"', () => {
    expect(needToKnowFreshness('A retrospective study published July 11, 2026 found the drug raises risk.', EDITION).fresh).toBe(true)
  })

  it('does NOT flag "revisits" in a hard-news context', () => {
    expect(needToKnowFreshness('Congress revisits the immigration bill on July 11, 2026.', EDITION).fresh).toBe(true)
  })
})

describe('needToKnowFreshness with the looser secondary-section window', () => {
  // Etcetera / In The Know tolerate older items than Need To Know, but a
  // month-old dated story (e.g. "McConnell hospitalized June 14" in a mid-July
  // edition) still leaked through because those sections had no freshness check.
  const JULY15 = new Date('2026-07-15T12:00:00Z')

  it('is 7 days', () => {
    expect(SECONDARY_SECTION_MAX_AGE_HOURS).toBe(168)
  })

  it('flags a ~month-old dated item under the 7-day window', () => {
    const text = 'Sen. Mitch McConnell (R-Kentucky) was hospitalized on June 14, 2026, according to PBS NewsHour reporting.'
    expect(needToKnowFreshness(text, JULY15, SECONDARY_SECTION_MAX_AGE_HOURS).fresh).toBe(false)
  })

  it('keeps an item dated within the past week', () => {
    expect(needToKnowFreshness('A quirky festival opened on July 12, 2026.', JULY15, SECONDARY_SECTION_MAX_AGE_HOURS).fresh).toBe(true)
  })

  it('keeps an undated quirky item (benefit of the doubt)', () => {
    expect(needToKnowFreshness('Italian army cadets rescued a driver from a sinking car.', JULY15, SECONDARY_SECTION_MAX_AGE_HOURS).fresh).toBe(true)
  })
})
