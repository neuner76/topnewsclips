import { describe, expect, it } from 'vitest'
import { pickFallbackNeedToKnow, selectNeedToKnowBackfill, pickComedyBackstop, type FallbackCandidate, type ComedyCandidate } from './digest-fallback'

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

// Comedy backstop: if the Comedy & Satire slot ends up empty, promote the
// freshest unused, non-evergreen comedy story so every digest has a comedy link.
describe('pickComedyBackstop', () => {
  const cc = (slug: string, created_at: string, category = 'comedy', text = 'topical satire'): ComedyCandidate =>
    ({ slug, created_at, category, text })
  const alwaysFresh = () => true

  it('returns null when there are no comedy candidates', () => {
    expect(pickComedyBackstop([cc('a', '2026-08-06', 'reported')], new Set(), alwaysFresh)).toBeNull()
    expect(pickComedyBackstop([], new Set(), alwaysFresh)).toBeNull()
  })

  it('promotes the freshest comedy candidate', () => {
    const picked = pickComedyBackstop(
      [cc('old', '2026-08-01'), cc('new', '2026-08-06'), cc('mid', '2026-08-03')],
      new Set(), alwaysFresh,
    )
    expect(picked?.slug).toBe('new')
  })

  it('skips slugs already used elsewhere in the digest', () => {
    const picked = pickComedyBackstop([cc('used', '2026-08-06'), cc('free', '2026-08-05')], new Set(['used']), alwaysFresh)
    expect(picked?.slug).toBe('free')
  })

  it('skips non-fresh (evergreen/stale) comedy via the isFresh predicate', () => {
    const isFresh = (text: string) => !text.includes('retrospective')
    const picked = pickComedyBackstop([cc('reel', '2026-08-06', 'comedy', 'a retrospective compilation'), cc('topical', '2026-08-05')], new Set(), isFresh)
    expect(picked?.slug).toBe('topical')
  })
})

// Thin-NTK backfill (Defect 1): the model sometimes returns 1-2 Need To Know
// items while lead-eligible domestic stories sit in the pool (they got routed to
// In The Know). The old rescue only fired on a COMPLETELY EMPTY NTK; this tops up
// any NTK below the 3-item floor from the best-corroborated eligible candidates,
// skipping topic-duplicates of what is already there (so it never adds a second
// copy of the same event).
describe('selectNeedToKnowBackfill', () => {
  const cand = (slug: string, coveredCount: number, title = slug, eligible = true): FallbackCandidate =>
    ({ slug, title, description: 'x'.repeat(200), coveredCount, eligible })
  const never = () => false

  it('fills an empty NTK up to the target, best-corroborated first', () => {
    const out = selectNeedToKnowBackfill([], [cand('a', 6), cand('b', 10), cand('c', 8), cand('d', 5)], never)
    expect(out.map(x => x.slug)).toEqual(['b', 'c', 'a'])
  })

  it('tops up a thin NTK, adding only what is missing', () => {
    const out = selectNeedToKnowBackfill([{ slug: 'x', title: 'X' }], [cand('a', 6), cand('b', 10)], never)
    expect(out.map(x => x.slug)).toEqual(['b', 'a'])
  })

  it('adds nothing when NTK already meets the target', () => {
    const cur = [{ slug: 'x', title: 'X' }, { slug: 'y', title: 'Y' }, { slug: 'z', title: 'Z' }]
    expect(selectNeedToKnowBackfill(cur, [cand('a', 10)], never)).toEqual([])
  })

  it('never re-adds a slug already in NTK', () => {
    const out = selectNeedToKnowBackfill([{ slug: 'a', title: 'A' }], [cand('a', 10), cand('b', 8)], never)
    expect(out.map(x => x.slug)).toEqual(['b'])
  })

  it('respects the corroboration floor and eligibility', () => {
    expect(selectNeedToKnowBackfill([], [cand('a', 4), cand('b', 3)], never)).toEqual([])
    expect(selectNeedToKnowBackfill([], [cand('a', 15, 'A', false)], never)).toEqual([])
  })

  it('skips a candidate that duplicates the topic of an already-selected item', () => {
    // Two Iran-strike versions (cov 9 and cov 7): keep the higher, skip the dup,
    // then fall through to the next distinct topic.
    const out = selectNeedToKnowBackfill(
      [],
      [cand('clancy', 10, 'Clancy trial'), cand('iran9', 9, 'Iran strike'), cand('iran7', 7, 'Iran strike'), cand('paxton', 6, 'Paxton endorsement')],
      (a, b) => a === b,
    )
    expect(out.map(x => x.slug)).toEqual(['clancy', 'iran9', 'paxton'])
  })
})

