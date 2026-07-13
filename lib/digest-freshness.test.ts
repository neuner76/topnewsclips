import { describe, expect, it } from 'vitest'
import { needToKnowFreshness } from './digest-freshness'

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
