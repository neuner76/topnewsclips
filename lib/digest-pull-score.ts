// Task 3 / Task 4 — per-story digest pull score + explainable pull reason.
//
// Scoring is LOCAL (a property of one story). Role is relational, so the
// caller may pass a DigestContext; if omitted we classify against an empty
// context. The weights and threshold below are CALIBRATION CONFIG, not law —
// run `npm run validate:digest` (Task 17) against a real day and tune the one
// constants block rather than scattering magic numbers.

import { getConfidenceLabel } from './confidence'
import { coverageCount } from './feed-editorial'
import { classifyDigestItemRole } from './digest-role-classifier'
import {
  assessStateAffiliated,
  detectBundledMultistory,
  isHighStakesGeopolitical,
} from './digest-risk'
import { emptyDigestContext, type DigestContext, type DigestItemRole, type DigestRiskFlag } from './digest-pull-types'
import type { Story } from './types'

// ── Calibration config — tune here, nowhere else ────────────────────────────
export const DIGEST_PULL_WEIGHTS = {
  majorPublicImpact: 4,
  practicalImpact: 3,
  institutionalSignal: 3,
  developingSafety: 3,
  sourceTierTop3: 2,
  corroborated: 2,
  reported: 1,
  broadCoverage: 2,
  undercoveredGlobal: 2,
  globalLensFrame: 1,
  econHealthSciContext: 2,
  // penalties (negative)
  stateAffiliatedHighStakes: -3,
  rawFootagePrimary: -2,
  singleSource: -2,
  zeroCoverage: -2,
  analysisNotReporting: -1,
  lightweightHumanInterest: -2,
  noClearRole: -4,
  bundledMultistory: -3,
} as const

export const DIGEST_INCLUSION_THRESHOLD = 3
// A story scoring at/above this is "lead strength" — the buried-lead floor
// (Task 4b) treats one placed outside Need To Know as a critical error. Set so
// that only a major-impact story (the +4 majorPublicImpact bonus plus strong
// sourcing) clears it; a merely well-sourced topic story does not.
export const DIGEST_LEAD_STRENGTH = 10

export interface DigestPullScoreResult {
  score: number
  role: DigestItemRole
  pullReason: string
  riskFlags: DigestRiskFlag[]
}

type ScorableStory = Pick<
  Story,
  | 'title' | 'description' | 'subcategory' | 'category'
  | 'source_tier' | 'source_type' | 'msm_outlet_coverage' | 'msm_gap'
  | 'journalist_username' | 'source' | 'region'
>

const HUMAN_INTEREST_RE = /\b(heartwarming|adorable|goes viral|wholesome|reunite|rescue puppy|cutest|feel-good)\b/i

export function calculateDigestPullScore(
  story: ScorableStory,
  context: DigestContext = emptyDigestContext()
): DigestPullScoreResult {
  const role = classifyDigestItemRole(story, context)
  const W = DIGEST_PULL_WEIGHTS
  const flags: DigestRiskFlag[] = []
  let score = 0

  const tier = story.source_tier ?? 99
  const label = getConfidenceLabel(story)
  const covered = coverageCount(story)
  const text = `${story.title ?? ''} ${story.description ?? ''}`

  // ── Additions ──
  const broadlyCovered = covered >= 5
  if (isHighStakesGeopolitical(story) && (broadlyCovered || role === 'lead')) score += W.majorPublicImpact
  // Practical-impact bonus is reserved for the practical_impact role so it
  // doesn't stack on top of the economic/health context bonus below and
  // inflate a well-sourced topic story to false lead strength.
  if (role === 'practical_impact') score += W.practicalImpact
  if (role === 'institutional_signal') score += W.institutionalSignal
  if (role === 'developing_safety') score += W.developingSafety
  if (tier <= 3) score += W.sourceTierTop3
  if (label === 'CORROBORATED') score += W.corroborated
  else if (label === 'REPORTED') score += W.reported
  if (broadlyCovered) score += W.broadCoverage
  if (role === 'undercovered_global') {
    score += W.undercoveredGlobal
    if (story.region && story.region !== 'World') score += W.globalLensFrame
  }
  if (role === 'economic_context' || role === 'health_science_context') score += W.econHealthSciContext

  // ── Penalties ──
  const state = assessStateAffiliated(story)
  if (state.flagged) {
    score += W.stateAffiliatedHighStakes
    flags.push('state_affiliated_high_stakes')
  }
  if (story.category === 'raw' && covered <= 1) {
    score += W.rawFootagePrimary
    flags.push('raw_footage_primary')
  }
  if (label === 'SINGLE-SOURCE' || covered <= 1) {
    if (label === 'SINGLE-SOURCE') flags.push('single_source')
    // single-source penalty
    score += W.singleSource
  }
  // 0-of-N coverage — but it does NOT apply when:
  //  - the role is developing_safety or undercovered_global (being uncovered is
  //    the point), or
  //  - the source is tier <= 6, which the confidence model already trusts as
  //    REPORTED regardless of corroboration. A zero MSM-coverage count on a
  //    credible newsroom is usually a headline-matching miss, not a fringe
  //    single source — penalizing it double-counts the single_source penalty.
  if (covered === 0 && role !== 'developing_safety' && role !== 'undercovered_global' && tier > 6) {
    score += W.zeroCoverage
    flags.push('zero_coverage')
  }
  if (story.category === 'analysis') {
    score += W.analysisNotReporting
    flags.push('analysis_not_reporting')
  }
  if (HUMAN_INTEREST_RE.test(text)) {
    score += W.lightweightHumanInterest
    flags.push('lightweight_human_interest')
  }
  if (role === 'archive_only') score += W.noClearRole
  if (detectBundledMultistory(story)) {
    score += W.bundledMultistory
    flags.push('bundled_multistory')
  }

  return { score, role, pullReason: generatePullReason(role, score, flags), riskFlags: flags }
}

const ROLE_REASON: Record<DigestItemRole, string> = {
  lead: 'lead: major development with broad sourcing',
  practical_impact: 'practical impact: a concrete effect on readers',
  institutional_signal: 'institutional signal: a policy, court, or agency development',
  undercovered_global: 'undercovered global story: international report with low U.S. coverage',
  mainstream_agenda_marker: 'mainstream agenda marker: what major outlets are leading with',
  economic_context: 'economic context: prices, markets, or business with consumer impact',
  health_science_context: 'health/science context: public-health, research, or environment',
  cultural_texture: 'cultural texture: lighter media/culture note, kept short',
  developing_safety: 'developing safety: breaking public-safety event, valuable while new',
  reader_utility: 'reader utility: an official process, deadline, or useful next step',
  archive_only: 'interesting but no clear reader-impact role',
}

export function generatePullReason(role: DigestItemRole, score: number, flags: DigestRiskFlag[]): string {
  const verb = score >= DIGEST_INCLUSION_THRESHOLD && role !== 'archive_only'
    ? 'Included as'
    : 'Excluded from canonical digest —'
  let reason = `${verb} ${ROLE_REASON[role]}.`
  if (flags.includes('state_affiliated_high_stakes')) {
    reason += ' State-affiliated source — caution shown.'
  }
  if (flags.includes('bundled_multistory')) {
    reason += ' Bundles two unrelated events — split or trim before publishing.'
  }
  return reason
}

export function meetsInclusionThreshold(result: DigestPullScoreResult): boolean {
  return result.score >= DIGEST_INCLUSION_THRESHOLD && result.role !== 'archive_only'
}
