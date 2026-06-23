// Coverage-count integrity (input-integrity layer beneath ranking).
//
// A coverage count of 0 means two opposite things depending on the story: for
// an obscure international item it's a genuine blindspot; for a domestic
// mass-casualty event, a natural disaster, a major US political moment, or a
// major market move it is implausible — wire services cover those within hours,
// so a 0/15 reading almost always means the clustering/MSM step ran before the
// wire caught up (counts are computed once at ingest and can go stale). This
// module flags those suspect zeros so downstream ranking/lead logic doesn't
// treat a probable data error as a real blindspot.

import { coverageCount } from './feed-editorial'
import { checkMSMCoverage, MSM_OUTLET_COUNT } from './ingest/msm-check'
import type { Story } from './types'

// Single source of truth: the distinct-outlet count from msm-check, so the
// denominator here can never disagree with what the coverage check produces.
export const MSM_OUTLET_TOTAL = MSM_OUTLET_COUNT

export type CoverageConfidence = 'confirmed' | 'suspect' | 'unverified'

export interface CoverageIntegrity {
  count: number
  total: number
  confidence: CoverageConfidence
  reason?: string // why suspect/unverified
}

type SalienceStory = Pick<Story, 'title' | 'description' | 'category' | 'region' | 'topic_role'> & { subcategory?: string | null }

// High-salience domestic signals — a 0/low count on any of these is implausible.
// Keyed on topic patterns + region, never on a specific story title.
const HIGH_SALIENCE_PATTERNS: Array<[string, RegExp]> = [
  ['mass_casualty', /\b(shooting|active shooter|mass shooting|gunman|opened fire|stabbing|killed|fatalities|casualties|wounded|hostages?|massacre|rampage)\b/i],
  ['disaster', /\b(tornado|hurricane|wildfire|flash flood|flooding|earthquake|mudslide|derailment|explosion|building collapse|bridge collapse)\b/i],
  ['us_political', /\b(supreme court|congress|senate|house vote|white house|federal|impeach\w*|executive order|government shutdown|presidential|electoral)\b/i],
  ['major_market', /\b(mass layoffs|bankruptc\w*|market crash|stocks? plunge|recession|interest rate|major ipo|bailout)\b/i],
  ['public_figure_death', /\b(dies|died|dead at|passes away|found dead|obituary)\b/i],
]

function salienceText(story: SalienceStory): string {
  return `${story.title ?? ''} ${story.description ?? ''} ${story.subcategory ?? ''}`
}

// Domestic = a US story. region carries the OUTLET's home country and US-desk
// stories are stored with a null region (see lib/ingest/pipeline.ts), so a null
// region is the domestic signal; an explicit non-US, non-World region is not.
function isDomestic(story: SalienceStory): boolean {
  return !story.region || story.region === 'United States' || story.region === 'US'
}

export function highSalienceCategory(story: SalienceStory): string | null {
  if (!isDomestic(story)) return null
  const text = salienceText(story)
  for (const [key, re] of HIGH_SALIENCE_PATTERNS) {
    if (re.test(text)) return key
  }
  return null
}

export function isHighSalienceDomestic(story: SalienceStory): boolean {
  return highSalienceCategory(story) !== null
}

// Hard-news topic roles (from the 3.2 classify pass) where an implausibly low
// coverage count is more likely a stale ingest-time snapshot than a real gap.
// Deliberately EXCLUDES undercovered_intl / curiosity_disclosure / culture_media /
// mainstream_agenda_marker, where a low count is expected and credible.
const HARD_NEWS_ROLES: ReadonlySet<string> = new Set([
  'geopolitical', 'public_safety', 'public_health', 'economic', 'infrastructure', 'legal_institutional',
])

export function isHardNewsRole(story: Pick<Story, 'topic_role'>): boolean {
  return !!story.topic_role && HARD_NEWS_ROLES.has(story.topic_role)
}

// Which candidates earn a live coverage re-check at generation. This is BROADER
// than flagSuspectCoverage (which only flags domestic implausibility and feeds the
// suspect/blindspot semantics relied on by several callers — left untouched here).
// A low count on any hard-news story, domestic OR international, is worth a fresh
// check: the dominant cause of a 0 there is a stale ingest-time snapshot, not a
// genuine gap (observed 2026-06: a 2-day-old Kyiv strike still read 0 of 15 while
// six tracked outlets had covered it).
export function shouldReverifyCoverage(
  story: SalienceStory & Pick<Story, 'msm_outlet_coverage' | 'topic_role'>
): boolean {
  if (coverageCount(story) > 1) return false
  return isHighSalienceDomestic(story) || isHardNewsRole(story)
}

function coverageTotalFor(story: Pick<Story, 'msm_outlet_coverage'>): number {
  const cov = story.msm_outlet_coverage
  if (!cov) return MSM_OUTLET_TOTAL
  return (cov.covered?.length ?? 0) + (cov.notCovered?.length ?? 0) || MSM_OUTLET_TOTAL
}

// Task 1: pure, no-network assessment. A high-salience domestic story with a
// near-zero count is flagged `suspect`; everything else is `confirmed` (its
// count is taken at face value). Task 2 re-verifies suspect items against the
// MSM set and may upgrade them to `confirmed` with a corrected count.
export function flagSuspectCoverage(story: SalienceStory & Pick<Story, 'msm_outlet_coverage'>): CoverageIntegrity {
  const count = coverageCount(story)
  const total = coverageTotalFor(story)
  const salience = highSalienceCategory(story)
  if (salience && count <= 1) {
    return {
      count,
      total,
      confidence: 'suspect',
      reason: `high-salience domestic (${salience}) story with only ${count} of ${total} outlets — implausibly low; likely a clustering/MSM-match miss`,
    }
  }
  return { count, total, confidence: 'confirmed' }
}

// Task 2: re-verify a suspect count against the MSM/wire set. The matcher is
// injected (defaults to the live Google-News check) so this is unit-testable
// offline. Only suspect items are re-checked — a small set per day — so this is
// a cheap backstop, not a re-clustering of everything.
//
//  - re-match finds >= 2 MSM outlets → upgrade to `confirmed` with the corrected
//    count (the original zero was a clustering/timing miss).
//  - re-match still finds nothing → stays `suspect`; we do NOT trust the zero.
export type CoverageMatcher = (query: string) => Promise<{ coveredBy: string[] }>

export const CONFIRMED_COVERAGE_FLOOR = 2

export async function reverifyCoverage(
  story: SalienceStory & Pick<Story, 'title' | 'msm_outlet_coverage'>,
  matcher: CoverageMatcher = checkMSMCoverage
): Promise<CoverageIntegrity> {
  const initial = flagSuspectCoverage(story)
  // Re-check whenever the candidate qualifies (domestic-suspect OR low-count
  // hard-news, incl. international). flagSuspectCoverage itself stays narrow so the
  // suspect/blindspot semantics its other callers depend on are unchanged.
  if (!shouldReverifyCoverage(story)) return initial

  try {
    const result = await matcher(story.title ?? '')
    const recovered = result.coveredBy?.length ?? 0
    if (recovered >= CONFIRMED_COVERAGE_FLOOR) {
      return { count: recovered, total: initial.total, confidence: 'confirmed', reason: 'corrected via relaxed MSM re-match' }
    }
    // Re-check found fewer than the floor.
    if (isHighSalienceDomestic(story)) {
      // A domestic high-salience zero stays implausible even after a re-check —
      // never grant the zero blindspot/undercovered credit; hold it suspect.
      return { count: initial.count, total: initial.total, confidence: 'suspect', reason: `${initial.reason ?? 'high-salience domestic zero'}; relaxed MSM re-match still found ${recovered} — held as suspect` }
    }
    // International / non-domestic hard-news: the live re-check is authoritative.
    // A confirmed low/zero count here is a GENUINE blindspot, not a data error.
    return { count: recovered, total: initial.total, confidence: 'confirmed', reason: `re-verified — ${recovered} MSM outlet(s)` }
  } catch {
    // Network/parse failure: we couldn't confirm anything, so leave the story
    // exactly as flagSuspectCoverage assessed it (domestic → suspect; international
    // → confirmed at face value). Don't invent a change either way.
    return { ...initial, reason: `${initial.reason ?? 'unverified'}; re-verification failed to run` }
  }
}

// Task 3: a count of 0 earns genuine-blindspot treatment ONLY when it is not
// high-salience domestic, IS international, and its coverage confidence is
// confirmed. A suspect zero is never a blindspot and never labeled
// "under-reported".
export function isGenuineBlindspotZero(
  story: SalienceStory & Pick<Story, 'msm_outlet_coverage' | 'msm_gap'>,
  integrity: CoverageIntegrity = flagSuspectCoverage(story)
): boolean {
  if (integrity.confidence !== 'confirmed') return false
  if (integrity.count > 0) return false
  if (isHighSalienceDomestic(story)) return false
  return !!story.region && story.region !== 'World'
}
