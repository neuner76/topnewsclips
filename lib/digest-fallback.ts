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

// Relaxed floor for topping up REMAINING Need To Know slots after the
// well-corroborated pass. Two independent outlets is a "this is real" bar — weak
// enough to fill a thin NTK on a light domestic day, strong enough to keep
// single-source stories out of the section. The lead-eligibility gate still runs
// afterward, so a relaxed-floor pick can only land in a non-lead slot.
export const FALLBACK_RELAXED_COVERAGE = 2

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
  relaxedCoverage = FALLBACK_RELAXED_COVERAGE,
): FallbackCandidate[] {
  const need = target - currentNtk.length
  if (need <= 0) return []
  const usedSlugs = new Set(currentNtk.map(i => i.slug))
  const chosenTitles = currentNtk.map(i => i.title)
  const result: FallbackCandidate[] = []
  // Graduated floors: fill from the best-corroborated stories first, then relax to
  // the lower floor only for slots still missing. This keeps the section's
  // preference for well-mirrored news while guaranteeing it is never shipped short
  // when an eligible, different-topic hard-news story exists in the pool. The old
  // single hard floor (5) left NTK at two items on a light domestic day whose only
  // high-coverage stories were the lead's own cluster (e.g. the Nov-17 FAA day).
  const floors = [...new Set([minCoverage, relaxedCoverage])].sort((a, b) => b - a)
  for (const floor of floors) {
    if (result.length >= need) break
    const taken = new Set([...usedSlugs, ...result.map(r => r.slug)])
    const pool = candidates
      .filter(c => c.eligible && c.coveredCount >= floor && !taken.has(c.slug))
      .sort((a, b) => b.coveredCount - a.coveredCount)
    for (const c of pool) {
      if (result.length >= need) break
      if (chosenTitles.some(t => sameTopic(t, c.title))) continue
      result.push(c)
      chosenTitles.push(c.title)
    }
  }
  return result
}

export interface LensCandidate {
  slug: string
  title: string
  outlet: string      // cleaned outlet name, used as the Lens region label
  summary: string     // honest factual gloss (the story's own lede), not a claimed "frame"
  sourceTier: number
}

export const GLOBAL_LENS_TARGET = 3

// Deterministic Global Lens backfill. The model intermittently returns an empty
// globalLens even when international outlets clearly cover the day's US-adjacent
// stories — a recurring "empty Lens" failure, not a genuine drought. This promotes
// REAL overlapping international stories: each must share a topic with something
// already on the US page (`overlapsUsPage`), so it is a genuine cross-origin lens
// on news the reader is already seeing, never random foreign filler. Public
// broadcasters (lower source_tier) are preferred, one item per outlet. Summaries
// are the stories' own factual ledes — the backfill never fabricates a framing
// claim. Returns the items to ADD; the caller only commits them if the section
// reaches its display floor of two (an empty Lens stays legitimately empty).
export function selectGlobalLensBackfill(
  current: { slug: string }[],
  usedSlugs: Set<string>,
  candidates: LensCandidate[],
  overlapsUsPage: (title: string) => boolean,
  target = GLOBAL_LENS_TARGET,
): { region: string; slug: string; title: string; summary: string }[] {
  const need = target - current.length
  if (need <= 0) return []
  const blocked = new Set<string>([...usedSlugs, ...current.map(i => i.slug)])
  const seenOutlets = new Set<string>()
  const pool = candidates
    .filter(c => c.slug && c.title && c.summary?.trim() && c.outlet && !blocked.has(c.slug))
    .filter(c => overlapsUsPage(c.title))
    .sort((a, b) => (a.sourceTier ?? 99) - (b.sourceTier ?? 99))
  const result: { region: string; slug: string; title: string; summary: string }[] = []
  for (const c of pool) {
    if (result.length >= need) break
    const outletKey = c.outlet.toLowerCase()
    if (seenOutlets.has(outletKey)) continue
    seenOutlets.add(outletKey)
    result.push({ region: c.outlet, slug: c.slug, title: c.title, summary: c.summary.trim() })
  }
  return result
}

export type InTheKnowCategory =
  | 'Politics & World Affairs'
  | 'Science & Technology'
  | 'Business & Markets'
  | 'Sports, Entertainment, & Culture'
  | 'Comedy & Satire'

export interface InTheKnowCandidate {
  slug: string
  title: string
  summary: string              // factual gloss (the story's own lede), not a claimed frame
  category: InTheKnowCategory  // caller-mapped from the story's section_fit taxonomy
  coveredCount: number         // independent MSM outlets corroborating the story
  sourceTier: number
}

// "This is real" floor: two independent outlets, matching the NTK relaxed floor.
// A dropped story must clear it to be rescued — single-source items stay out.
export const IN_THE_KNOW_BACKFILL_MIN_COVERAGE = 2
// Rescue an EMPTY category to a single strong item — never pad toward a quota.
// The prompt's rule stands ("an honestly empty section beats forced filler"); this
// only fires when a genuinely corroborated, topic-matched story was dropped whole.
export const IN_THE_KNOW_BACKFILL_TARGET = 1

// Deterministic In The Know backfill. The model sometimes returns a topic shelf
// EMPTY while a strong, published, well-corroborated story that belongs there sits
// unused in the pool (Nov-23: Science & Technology blank, a 3-outlet BBC story on
// self-improving AI placed nowhere, on the most AI-driven news week of the cycle).
// Unlike NTK/Global Lens, In The Know had no net. This rescues the strongest
// matching candidate for each category the caller flags — but ONLY when that
// category is below target (empty): it never pads a shelf the model already filled,
// never drops below the coverage floor, skips used slugs, and skips topic-dups of
// anything already on the page (via the injected `sameTopic`). Summaries are the
// stories' own ledes — the backfill never fabricates. Returns additions to commit.
export function selectInTheKnowBackfill(
  current: Partial<Record<InTheKnowCategory, { slug: string | null; text: string }[]>>,
  categories: InTheKnowCategory[],
  candidates: InTheKnowCandidate[],
  usedSlugs: Set<string>,
  sameTopic: (a: string, b: string) => boolean,
  target = IN_THE_KNOW_BACKFILL_TARGET,
  minCoverage = IN_THE_KNOW_BACKFILL_MIN_COVERAGE,
): { category: InTheKnowCategory; slug: string; text: string }[] {
  const taken = new Set<string>(usedSlugs)
  // Titles of everything already shown anywhere in In The Know, so a rescued pick
  // can't repeat a topic the reader is already seeing on another shelf.
  const pageTitles: string[] = []
  for (const items of Object.values(current)) for (const i of items ?? []) pageTitles.push(i.text)

  const result: { category: InTheKnowCategory; slug: string; text: string }[] = []
  for (const cat of categories) {
    const need = target - (current[cat]?.length ?? 0)
    if (need <= 0) continue // empty-only: never pad a shelf the model already filled
    const pool = candidates
      .filter(c => c.category === cat && c.slug && c.summary?.trim() && c.coveredCount >= minCoverage && !taken.has(c.slug))
      // Best-corroborated first; break ties toward the more authoritative (lower) tier.
      .sort((a, b) => b.coveredCount - a.coveredCount || (a.sourceTier ?? 99) - (b.sourceTier ?? 99))
    let added = 0
    for (const c of pool) {
      if (added >= need) break
      if (pageTitles.some(t => sameTopic(t, c.title))) continue
      result.push({ category: cat, slug: c.slug, text: c.summary.trim() })
      taken.add(c.slug)
      pageTitles.push(c.title)
      added++
    }
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
