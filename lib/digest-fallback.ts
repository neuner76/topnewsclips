// Defensive net for an empty Need To Know. If the LLM leaves NTK empty but a
// domestic, NTK-eligible hard-news story is strongly MSM-corroborated, promote
// the strongest one so the edition is never silently withheld over a story that
// is demonstrably real. Deterministic — does not depend on the LLM's judgment.
// (Root fix lives in confidence.ts; this only catches the residual case.)

export interface FallbackCandidate {
  slug: string
  title: string
  description?: string | null
  coveredCount: number // msm_outlet_coverage.covered.length — independent MSM outlets
  eligible: boolean    // isNeedToKnowEligible: region-less hard news, decent tier, etc.
}

// Default floor: 5 independent MSM outlets. One below the confidence.ts
// CORROBORATED threshold (6) so a story on the cusp still rescues the edition.
export const FALLBACK_MIN_COVERAGE = 5

export function pickFallbackNeedToKnow(
  candidates: FallbackCandidate[],
  minCoverage = FALLBACK_MIN_COVERAGE,
): FallbackCandidate | null {
  const eligible = candidates.filter(c => c.eligible && c.coveredCount >= minCoverage)
  if (eligible.length === 0) return null
  eligible.sort((a, b) => b.coveredCount - a.coveredCount)
  return eligible[0]
}

export const NEED_TO_KNOW_TARGET = 3

// Thin-NTK backfill. The model sometimes returns fewer than NEED_TO_KNOW_TARGET
// Need To Know items while lead-eligible domestic stories sit in the candidate
// pool (routed to In The Know instead). This tops NTK up to the target from the
// best-corroborated eligible candidates, skipping any that duplicate the topic of
// a story already in NTK (via the injected `sameTopic`, matching the validator's
// significant-word overlap) so it never adds a second copy of the same event.
// Deterministic and does not trust the model. Returns the items to ADD, in order.
export function selectNeedToKnowBackfill(
  currentNtk: { slug: string; title: string }[],
  candidates: FallbackCandidate[],
  sameTopic: (a: string, b: string) => boolean,
  target = NEED_TO_KNOW_TARGET,
  minCoverage = FALLBACK_MIN_COVERAGE,
): FallbackCandidate[] {
  const need = target - currentNtk.length
  if (need <= 0) return []
  const usedSlugs = new Set(currentNtk.map(i => i.slug))
  const chosenTitles = currentNtk.map(i => i.title)
  const pool = candidates
    .filter(c => c.eligible && c.coveredCount >= minCoverage && !usedSlugs.has(c.slug))
    .sort((a, b) => b.coveredCount - a.coveredCount)
  const result: FallbackCandidate[] = []
  for (const c of pool) {
    if (result.length >= need) break
    if (chosenTitles.some(t => sameTopic(t, c.title))) continue
    result.push(c)
    chosenTitles.push(c.title)
  }
  return result
}

export interface ComedyCandidate {
  slug: string
  category?: string | null
  created_at?: string | null
  text: string // title + description, for the freshness/evergreen check
}

// Guarantees a comedy link: when the Comedy & Satire slot is empty after
// generation, promote the freshest unused, non-evergreen comedy story. `isFresh`
// is the caller's needToKnowFreshness check, so evergreen reels (excluded by the
// EVERGREEN_PATTERN) and stale clips are skipped automatically.
export function pickComedyBackstop(
  candidates: ComedyCandidate[],
  usedSlugs: Set<string>,
  isFresh: (text: string) => boolean,
): ComedyCandidate | null {
  const pool = candidates.filter(c => c.category === 'comedy' && !usedSlugs.has(c.slug) && isFresh(c.text))
  if (pool.length === 0) return null
  pool.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return pool[0]
}
