// Same-incident dedup for the Need To Know candidate pool (Defect 2). When one
// event appears at multiple coverage levels (e.g. a 1/15 clip and a 9/15 clip of
// the same US-Iran strike), the model could lead Need To Know with the weak copy
// while the strong one sat in a lower section. Collapsing same-incident candidates
// to their best-corroborated version BEFORE the model sees the pool makes that
// impossible — the weak copy is never an NTK option.
//
// `sameIncident` is injected (the caller supplies significant-word overlap, the
// same signal the ingest pipeline uses) so this stays pure and unit-testable.
// Applied only to the NTK pool: a dropped copy is still available to In The Know,
// so an over-eager merge degrades gracefully rather than losing a story outright.
export function dedupeByIncident<T>(
  items: T[],
  getTitle: (t: T) => string,
  getCoverage: (t: T) => number,
  sameIncident: (a: string, b: string) => boolean,
): T[] {
  const kept: T[] = []
  for (const item of items) {
    const dupIdx = kept.findIndex(k => sameIncident(getTitle(k), getTitle(item)))
    if (dupIdx === -1) {
      kept.push(item)
    } else if (getCoverage(item) > getCoverage(kept[dupIdx])) {
      // A better-corroborated version of an incident already kept — swap it in,
      // preserving the group's original position in the ordering.
      kept[dupIdx] = item
    }
    // else: a weaker (or equal) duplicate of an incident already kept — drop it.
  }
  return kept
}
