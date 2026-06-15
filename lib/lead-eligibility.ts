// Lead-slot hard eligibility gate.
//
// The lead Need To Know story sets the trust standard for the whole digest, so
// it must be reported, credibly sourced, corroborated, and consequential. This
// is a HARD GATE applied during assembly BEFORE lead ranking — scoring alone
// must never be able to promote a structurally weak story to the lead slot.
//
// Task 0 mapping (IMPORTANT): there is no `story.contentType` column. The real
// taxonomy is `category` ('raw'|'reported'|'analysis'|'comedy'|null) plus the
// computed confidence label, `source_tier`, and `msm_outlet_coverage`. The gate
// derives a lead content-type from those rather than reading a field that does
// not exist (which would make `Set.has()` silently pass everything). See
// deriveLeadContentType below.

import { getConfidenceLabel } from './confidence'
import { coverageCount } from './feed-editorial'
import type { CanonicalDigestSectionName } from './digest-canonical'
import type { SourcePolicy } from './source-policy'
import type { Story } from './types'

export type LeadEligibilityStatus = 'eligible' | 'blocked' | 'override_required'

export interface LeadEligibilityResult {
  status: LeadEligibilityStatus
  reasons: string[]
  requiredOverrideReason?: string
  suggestedSection?: CanonicalDigestSectionName
}

// The story shape the gate reads — a structural subset of Story so callers can
// pass lighter rows.
export type LeadCandidate = Pick<
  Story,
  | 'title' | 'description' | 'subcategory' | 'category'
  | 'source_tier' | 'source_type' | 'msm_outlet_coverage' | 'msm_gap'
  | 'journalist_username' | 'source' | 'region'
>

// Per-story, transient override (lives on the edition, never mutates source
// policy). allowLead lifts an `override_required` gate; reason is mandatory.
export interface LeadEditorialOverride {
  allowLead?: boolean
  allowRestrictedSource?: boolean
  reason: string
}

// ── Task 0: content-type derivation ─────────────────────────────────────────
export type LeadContentType =
  | 'reported'
  | 'investigative'
  | 'official_primary_source'
  | 'breaking_reported'
  | 'developing_reported'
  | 'commentary_analysis'
  | 'opinion'
  | 'satire'
  | 'cultural_lens'
  | 'raw_footage'
  | 'social_clip'
  | 'creator_commentary'

const LEAD_ALLOWED_CONTENT_TYPES = new Set<LeadContentType>([
  'reported',
  'investigative',
  'official_primary_source',
  'breaking_reported',
  'developing_reported',
])

const LEAD_BLOCKED_CONTENT_TYPES = new Set<LeadContentType>([
  'commentary_analysis',
  'opinion',
  'satire',
  'cultural_lens',
  'raw_footage',
  'social_clip',
  'creator_commentary',
])

// Map the real `category` taxonomy onto the gate's content-type enum. Where the
// data doesn't carry a distinction (investigative vs reported, opinion vs
// commentary) we collapse to the nearest enforced bucket — the gate only cares
// which SET a type lands in, and every collapse preserves that.
export function deriveLeadContentType(story: Pick<Story, 'category' | 'source_tier'>): LeadContentType {
  switch (story.category) {
    case 'comedy':
      return 'satire'
    case 'analysis':
      // A low-accountability creator's commentary (T7+) is creator_commentary;
      // a credible newsroom's analysis is commentary_analysis. Both are blocked
      // from lead, but the distinction sharpens the validation message.
      return (story.source_tier ?? 99) >= 7 ? 'creator_commentary' : 'commentary_analysis'
    case 'raw':
      return 'raw_footage'
    case 'reported':
    case null:
    case undefined:
    default:
      return 'reported'
  }
}

function isSingleSource(story: LeadCandidate): boolean {
  return getConfidenceLabel(story) === 'SINGLE-SOURCE' || coverageCount(story) <= 1
}

// ── Task 2: content-type gate ───────────────────────────────────────────────
export function checkLeadContentType(story: LeadCandidate): LeadEligibilityResult {
  const contentType = deriveLeadContentType(story)
  if (LEAD_BLOCKED_CONTENT_TYPES.has(contentType)) {
    return {
      status: 'blocked',
      reasons: [`Lead slot requires reported substance; ${humanContentType(contentType)} cannot occupy the lead slot.`],
      suggestedSection: suggestNonLeadSection(story),
    }
  }
  if (!LEAD_ALLOWED_CONTENT_TYPES.has(contentType)) {
    return {
      status: 'override_required',
      reasons: ['Unknown or weak content type for lead slot.'],
      requiredOverrideReason: 'Explain why this non-standard story type should lead the digest.',
    }
  }
  return { status: 'eligible', reasons: [] }
}

function humanContentType(t: LeadContentType): string {
  switch (t) {
    case 'commentary_analysis': return 'Commentary / Analysis'
    case 'creator_commentary': return 'Creator commentary'
    case 'satire': return 'Satire'
    case 'cultural_lens': return 'Cultural lens'
    case 'raw_footage': return 'Raw footage'
    case 'social_clip': return 'Social clip'
    case 'opinion': return 'Opinion'
    default: return t
  }
}

// ── Task 3: corroboration gate ──────────────────────────────────────────────
export const LEAD_MIN_COVERAGE = 4
export const LEAD_LOW_COVERAGE = 2

export function checkLeadCorroboration(story: LeadCandidate): LeadEligibilityResult {
  const coverage = coverageCount(story)
  const label = getConfidenceLabel(story)

  if (isSingleSource(story)) {
    return {
      status: 'override_required',
      reasons: ['Single-source story cannot lead without editorial override.'],
      requiredOverrideReason: 'Explain why a single-source story is the most important story of the day.',
    }
  }
  if (coverage <= LEAD_LOW_COVERAGE) {
    return {
      status: 'override_required',
      reasons: [`Lead slot requires meaningful corroboration; this item has only ${coverage} of ${coverageTotalFor(story)} outlets.`],
      requiredOverrideReason: 'Explain why a low-corroboration story should lead.',
    }
  }
  if (coverage >= LEAD_MIN_COVERAGE || label === 'CORROBORATED') {
    return { status: 'eligible', reasons: [] }
  }
  return {
    status: 'override_required',
    reasons: ['Lead corroboration is below the preferred threshold.'],
    requiredOverrideReason: 'Explain why this below-threshold story should lead.',
  }
}

function coverageTotalFor(story: LeadCandidate): number {
  const cov = story.msm_outlet_coverage
  if (!cov) return 14
  return (cov.covered?.length ?? 0) + (cov.notCovered?.length ?? 0) || 14
}

// ── Task 4: source-tier gate ────────────────────────────────────────────────
export function checkLeadSourceTier(story: LeadCandidate): LeadEligibilityResult {
  const tier = story.source_tier
  if (!tier) {
    return {
      status: 'override_required',
      reasons: ['Missing source tier for lead story.'],
      requiredOverrideReason: 'Confirm the source class before leading with this story.',
    }
  }
  if (tier <= 6) return { status: 'eligible', reasons: [] }
  if (tier === 7) {
    return {
      status: 'override_required',
      reasons: ['T7 source requires editorial override for lead placement.'],
      requiredOverrideReason: 'Explain why this lower-accountability source should lead.',
    }
  }
  return {
    status: 'blocked',
    reasons: ['T8+ source cannot occupy the lead slot without an exceptional source-policy override.'],
    suggestedSection: suggestNonLeadSection(story),
  }
}

// ── Task 5: consequence gate (minimal; upgrade once rank spec lands) ─────────
// TODO(rank-spec): replace this keyword heuristic with the importance
// dimensions (publicImpact / practicalImpact) once that spec is implemented.
const CONSEQUENCE_PATTERN =
  /\b(wars?|missiles?|strikes?|airstrikes?|troops?|invasions?|ceasefires?|nuclear|sanctions?|migrant\w*|migration|asylum|refugees?|court|ruling|supreme court|congress|senate|parliament|election\w*|policy|legislation|recall|outbreak|disease|evacuat\w*|hurricane|wildfire|earthquake|flood\w*|shooting|inflation|interest rates?|tariffs?|recession|layoffs?|prices?|deadline|infrastructure|treaty|hostages?|coup)\b/i

export function checkLeadConsequence(story: LeadCandidate): LeadEligibilityResult {
  const text = `${story.title ?? ''} ${story.description ?? ''} ${story.subcategory ?? ''}`
  if (CONSEQUENCE_PATTERN.test(text)) return { status: 'eligible', reasons: [] }
  return {
    status: 'override_required',
    reasons: ['Lead appears consequence-thin (no broad public-impact signal detected).'],
    requiredOverrideReason: 'Explain the broad public consequence that justifies leading with this story.',
  }
}

// ── Task 5: restricted-source gate (reads table-backed policy) ──────────────
export function checkRestrictedSource(
  story: LeadCandidate,
  policy: SourcePolicy | undefined
): LeadEligibilityResult {
  if (!policy || policy.status === 'active') return { status: 'eligible', reasons: [] }

  const handle = policy.handle ? `@${policy.handle}` : 'this source'
  if (policy.status === 'deactivated') {
    return {
      status: 'blocked',
      reasons: [`Restricted source policy: ${handle} is deactivated and cannot appear in the canonical digest.`],
      suggestedSection: suggestNonLeadSection(story),
    }
  }
  // restricted / pending_reclassification: block from lead if the lead slot (or
  // need_to_know) is in blockedSlots, else require override.
  const blocksLead = policy.blockedSlots.includes('lead') || policy.blockedSlots.includes('need_to_know')
  if (blocksLead) {
    return {
      status: 'override_required',
      reasons: [`Restricted source policy: ${handle} is ${policy.status.replace('_', ' ')} and cannot lead without editorial review.`],
      requiredOverrideReason: policy.reason ?? 'Explain why a restricted source should lead.',
    }
  }
  return { status: 'eligible', reasons: [] }
}

// ── Task 5: compose the gate ────────────────────────────────────────────────
export function evaluateLeadEligibility(
  story: LeadCandidate,
  opts: { policy?: SourcePolicy; override?: LeadEditorialOverride } = {}
): LeadEligibilityResult {
  const checks = [
    checkRestrictedSource(story, opts.policy),
    checkLeadContentType(story),
    checkLeadSourceTier(story),
    checkLeadCorroboration(story),
    checkLeadConsequence(story),
  ]
  const combined = combineLeadEligibilityResults(checks)

  // A per-story override lifts ONLY override_required gates, never a hard block,
  // and only with a reason. It never suppresses the recorded reasons.
  if (combined.status === 'override_required' && opts.override?.allowLead && opts.override.reason) {
    return { ...combined, status: 'eligible', reasons: [...combined.reasons, `Editorial override: ${opts.override.reason}`] }
  }
  return combined
}

// Worst status wins: any blocked → blocked; else any override_required →
// override_required; else eligible. Reasons accumulate; the first suggested
// section is carried.
export function combineLeadEligibilityResults(results: LeadEligibilityResult[]): LeadEligibilityResult {
  const reasons: string[] = []
  let requiredOverrideReason: string | undefined
  let suggestedSection: CanonicalDigestSectionName | undefined
  let status: LeadEligibilityStatus = 'eligible'

  for (const r of results) {
    reasons.push(...r.reasons)
    requiredOverrideReason ??= r.requiredOverrideReason
    suggestedSection ??= r.suggestedSection
    if (r.status === 'blocked') status = 'blocked'
    else if (r.status === 'override_required' && status !== 'blocked') status = 'override_required'
  }

  const out: LeadEligibilityResult = { status, reasons: status === 'eligible' ? [] : reasons }
  if (status === 'override_required' && requiredOverrideReason) out.requiredOverrideReason = requiredOverrideReason
  if (status !== 'eligible' && suggestedSection) out.suggestedSection = suggestedSection
  return out
}

// Best-effort routing hint for a story that can't lead. Topic-driven; mirrors
// ROLE_TO_SECTION intent without importing the assembly layer.
export function suggestNonLeadSection(story: LeadCandidate): CanonicalDigestSectionName {
  if (story.category === 'comedy') return 'Culture, Media & Society'
  if (story.region && story.region !== 'World' && (story.msm_gap || coverageCount(story) <= 2)) return 'Global Blindspot'
  return 'Politics & World Affairs'
}
