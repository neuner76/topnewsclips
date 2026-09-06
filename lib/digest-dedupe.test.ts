import { describe, expect, it } from 'vitest'
import { dedupeByIncident } from './digest-dedupe'

// Defect 2: when the same event is present at multiple coverage levels (e.g. a
// BBC clip at 1/15 and a CNN clip at 9/15 of the same US-Iran strike), the model
// could put the WEAK-coverage version in Need To Know and bury the strong one in
// a lower section. dedupeByIncident collapses same-incident candidates to their
// best-corroborated version before the model sees the NTK pool, so it can never
// lead with the weak copy. sameIncident is injected (significant-word overlap).
describe('dedupeByIncident', () => {
  const item = (slug: string, title: string, coveredCount: number) => ({ slug, title, coveredCount })
  const byExactTitle = (a: string, b: string) => a === b

  it('leaves distinct incidents untouched', () => {
    const out = dedupeByIncident(
      [item('a', 'Iran strike', 5), item('b', 'Fed rate cut', 8)],
      i => i.title, i => i.coveredCount, byExactTitle,
    )
    expect(out.map(i => i.slug)).toEqual(['a', 'b'])
  })

  it('drops a weaker-coverage duplicate, keeping the best-corroborated version', () => {
    const out = dedupeByIncident(
      [item('cnn', 'Iran strike', 9), item('bbc', 'Iran strike', 1)],
      i => i.title, i => i.coveredCount, byExactTitle,
    )
    expect(out.map(i => i.slug)).toEqual(['cnn'])
  })

  it('replaces an earlier weaker version with a later higher-coverage one, keeping position', () => {
    const out = dedupeByIncident(
      [item('bbc', 'Iran strike', 1), item('other', 'Fed rate cut', 4), item('cnn', 'Iran strike', 9)],
      i => i.title, i => i.coveredCount, byExactTitle,
    )
    // Iran slot keeps its original position but now holds the cnn (cov 9) copy.
    expect(out.map(i => i.slug)).toEqual(['cnn', 'other'])
  })

  it('collapses three copies of one incident to the single best', () => {
    const out = dedupeByIncident(
      [item('a', 'Iran strike', 3), item('b', 'Iran strike', 9), item('c', 'Iran strike', 6)],
      i => i.title, i => i.coveredCount, byExactTitle,
    )
    expect(out.map(i => i.slug)).toEqual(['b'])
  })

  it('matches on a real incident predicate, not just exact titles', () => {
    const sameIran = (a: string, b: string) => a.includes('Iran') && b.includes('Iran')
    const out = dedupeByIncident(
      [item('bbc', 'Iran reports 18 killed in US strikes', 1), item('cnn', 'US military strikes Iran; Tehran retaliates', 9)],
      i => i.title, i => i.coveredCount, sameIran,
    )
    expect(out.map(i => i.slug)).toEqual(['cnn'])
  })

  it('does not mutate the input array', () => {
    const input = [item('cnn', 'Iran strike', 9), item('bbc', 'Iran strike', 1)]
    const snapshot = input.map(i => i.slug)
    dedupeByIncident(input, i => i.title, i => i.coveredCount, byExactTitle)
    expect(input.map(i => i.slug)).toEqual(snapshot)
  })
})
