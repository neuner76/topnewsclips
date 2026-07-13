import { describe, expect, it } from 'vitest'
import { pickFallbackNeedToKnow, type FallbackCandidate } from './digest-fallback'

// Belt-and-suspenders: if Need To Know ends up empty but a domestic hard-news
// story is strongly MSM-corroborated, promote it rather than ship an empty
// edition (the Graham-death failure mode). Deterministic — does not trust the LLM.
const c = (slug: string, coveredCount: number, eligible = true): FallbackCandidate =>
  ({ slug, title: slug, description: 'x'.repeat(200), coveredCount, eligible })

describe('pickFallbackNeedToKnow', () => {
  it('returns null when there are no candidates', () => {
    expect(pickFallbackNeedToKnow([])).toBeNull()
  })

  it('promotes the strongest-corroborated eligible domestic story', () => {
    const picked = pickFallbackNeedToKnow([c('a', 5), c('b', 9), c('c', 6)])
    expect(picked?.slug).toBe('b')
  })

  it('ignores stories below the corroboration floor', () => {
    expect(pickFallbackNeedToKnow([c('a', 4), c('b', 2)])).toBeNull()
  })

  it('never promotes an ineligible story, however well covered', () => {
    expect(pickFallbackNeedToKnow([c('intl', 15, false)])).toBeNull()
  })

  it('honors a custom minimum-coverage floor', () => {
    expect(pickFallbackNeedToKnow([c('a', 6)], 7)).toBeNull()
    expect(pickFallbackNeedToKnow([c('a', 7)], 7)?.slug).toBe('a')
  })
})
