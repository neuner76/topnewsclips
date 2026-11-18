import { describe, expect, it } from 'vitest'
import { pickFallbackNeedToKnow, selectNeedToKnowBackfill, selectGlobalLensBackfill, pickComedyBackstop, type FallbackCandidate, type ComedyCandidate, type LensCandidate } from './digest-fallback'

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

  it('relaxes to the lower floor to fill remaining slots, strongest first', () => {
    // No story clears the preferred floor (5); the relaxed floor (2) admits the
    // cov-4 and cov-3 stories so a thin NTK still fills, best-corroborated first.
    const out = selectNeedToKnowBackfill([], [cand('a', 4), cand('b', 3), cand('c', 2)], never)
    expect(out.map(x => x.slug)).toEqual(['a', 'b', 'c'])
  })

  it('fills well-corroborated slots first, then relaxes only for the remainder', () => {
    // One cov-8 story takes a slot at the preferred floor; the relaxed pass then
    // tops up the rest from cov-3/cov-2, never reordering the strong pick below them.
    const out = selectNeedToKnowBackfill([], [cand('strong', 8), cand('mid', 3), cand('weak', 2)], never)
    expect(out.map(x => x.slug)).toEqual(['strong', 'mid', 'weak'])
  })

  it('still excludes single/zero-source stories below the relaxed floor', () => {
    expect(selectNeedToKnowBackfill([], [cand('a', 1), cand('b', 0)], never)).toEqual([])
  })

  it('never promotes an ineligible story however well covered', () => {
    expect(selectNeedToKnowBackfill([], [cand('a', 15, 'A', false)], never)).toEqual([])
  })

  it('honors a custom relaxed floor', () => {
    // Raising the relaxed floor to 4 keeps the cov-3 story out.
    expect(selectNeedToKnowBackfill([], [cand('a', 3)], never, 3, 5, 4)).toEqual([])
    expect(selectNeedToKnowBackfill([], [cand('a', 4)], never, 3, 5, 4).map(x => x.slug)).toEqual(['a'])
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

// Global Lens backfill: the model intermittently ships an empty Lens even when
// international outlets clearly cover the day's US-adjacent stories. The backfill
// promotes real overlapping international stories (public broadcasters first, one
// per outlet) and never fabricates a framing claim.
describe('selectGlobalLensBackfill', () => {
  const lc = (slug: string, title: string, outlet: string, sourceTier = 3, summary = `${outlet} reports: ${title}`): LensCandidate =>
    ({ slug, title, outlet, summary, sourceTier })
  // Overlaps the US page when the title mentions one of the day's page topics.
  const overlaps = (title: string) => /gaza|kyiv|myanmar/i.test(title)

  it('fills an empty Lens from overlapping international stories, public broadcasters first', () => {
    const out = selectGlobalLensBackfill(
      [], new Set(),
      [lc('kyiv', 'Russia strikes Kyiv', 'DW News', 6), lc('myanmar', 'Myanmar genocide verdict', 'Al Jazeera', 3), lc('gaza', 'Israeli airstrike on Gaza hospital', 'France 24', 4)],
      overlaps,
    )
    expect(out.map(x => x.slug)).toEqual(['myanmar', 'gaza', 'kyiv'])
    expect(out[0].region).toBe('Al Jazeera')
    expect(out[0].summary).toContain('Myanmar')
  })

  it('excludes international stories that do not overlap anything on the US page', () => {
    const out = selectGlobalLensBackfill(
      [], new Set(),
      [lc('fifa', 'France football chief enters FIFA race', 'France 24'), lc('turtles', 'Sea turtles return to coast', 'ABC')],
      overlaps,
    )
    expect(out).toEqual([])
  })

  it('skips slugs already used elsewhere on the page or already in Lens', () => {
    const out = selectGlobalLensBackfill(
      [{ slug: 'gaza' }], new Set(['kyiv']),
      [lc('gaza', 'Gaza strike', 'France 24'), lc('kyiv', 'Kyiv strike', 'DW News'), lc('myanmar', 'Myanmar verdict', 'Al Jazeera')],
      overlaps,
    )
    expect(out.map(x => x.slug)).toEqual(['myanmar'])
  })

  it('caps at one item per outlet', () => {
    const out = selectGlobalLensBackfill(
      [], new Set(),
      [lc('a', 'Gaza one', 'Al Jazeera', 3), lc('b', 'Kyiv two', 'Al Jazeera', 3), lc('c', 'Myanmar three', 'DW News', 3)],
      overlaps,
    )
    expect(out.map(x => x.slug)).toEqual(['a', 'c'])
  })

  it('adds nothing when Lens already meets the target', () => {
    const cur = [{ slug: 'x' }, { slug: 'y' }, { slug: 'z' }]
    expect(selectGlobalLensBackfill(cur, new Set(), [lc('gaza', 'Gaza strike', 'DW News')], overlaps)).toEqual([])
  })

  it('drops candidates with no summary', () => {
    const out = selectGlobalLensBackfill(
      [], new Set(),
      [{ slug: 'gaza', title: 'Gaza strike', outlet: 'DW News', summary: '   ', sourceTier: 3 }],
      overlaps,
    )
    expect(out).toEqual([])
  })
})

