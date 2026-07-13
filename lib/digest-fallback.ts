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
