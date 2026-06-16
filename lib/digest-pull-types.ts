// Digest pull quality — shared role, risk, and context types.
//
// Two layers of quality control live here:
//   - Per-story properties: weak source, no clear role (scoring is local).
//   - Relational properties: a topic duplicated across sections, a region
//     over-represented in Blindspot, a World view lens that doesn't match its
//     lead. These only exist in the context of the assembled digest, so role
//     classification and placement receive a DigestContext (see below).
//
// See docs/superpowers/plans/2026-06-14-digest-pull-quality.md.

export type DigestItemRole =
  | 'lead'
  | 'practical_impact'
  | 'institutional_signal'
  | 'undercovered_global'
  | 'mainstream_agenda_marker'
  | 'economic_context'
  | 'health_science_context'
  | 'cultural_texture'
  | 'developing_safety'
  | 'reader_utility'
  | 'archive_only'

export type DigestRiskFlag =
  | 'state_affiliated_high_stakes'
  | 'raw_footage_primary'
  | 'zero_coverage'
  | 'single_source'
  | 'analysis_not_reporting'
  | 'lightweight_human_interest'
  | 'misplaced_section'
  | 'country_label_without_outlet'
  // region value disagrees with the story's actual origin/content
  // (higher severity than country_label_without_outlet)
  | 'region_label_mismatch'
  // one item's summary covers two or more unrelated events
  | 'bundled_multistory'
  // a high-salience domestic story whose implausibly-low coverage count could
  // not be confirmed — must not receive undercovered/blindspot ranking credit
  | 'coverage_suspect'

export interface DigestPullMetadata {
  role: DigestItemRole
  pullReason: string
  pullScore: number
  exclusionReason?: string
  riskFlags?: DigestRiskFlag[]
}

// Relational context threaded into classification and placement so that
// cross-section defects are caught during assembly, not retrofitted later.
// Built incrementally as the digest fills (see lib/digest-assembly.ts).
export interface DigestContext {
  rolesFilled: DigestItemRole[]
  topicsPresent: string[]   // for duplicate-topic suppression (Task 6)
  regionsPresent: string[]  // for Blindspot regional diversity (Task 12)
  leadTopic?: string
}

export function emptyDigestContext(): DigestContext {
  return { rolesFilled: [], topicsPresent: [], regionsPresent: [] }
}

// Editorial escape hatch — strict by default, but an admin can force an
// inclusion with a reason. Never suppresses state-affiliated caution (Task 7).
export interface EditorialPullOverride {
  include?: boolean
  section?: string
  role?: DigestItemRole
  reason: string
  caution?: string
}
