// Task 14 — canonical digest pull assembly.
//
// Builds a selected edition from the raw story pool by running each candidate
// through classify → score → risk → place → cap → suppress, threading a
// DigestContext so relational defects (duplicate topics, buried leads, region
// over-representation) are caught DURING assembly rather than retrofitted.
//
// This is the SELECTION layer. Presentation mapping of an already-generated
// LLM digest lives in lib/digest-canonical.ts (buildDigestEdition); this
// function is the from-pool entry point the plan calls
// buildCanonicalDigestFromStoryPool. Both must ultimately drive ONE edition
// for email and web — selection/order/labeling identical, layout-only diffs.

import { calculateDigestPullScore, meetsInclusionThreshold, DIGEST_LEAD_STRENGTH } from './digest-pull-score'
import {
  assessStateAffiliated,
  detectBundledMultistory,
  hasRegionLabelMismatch,
} from './digest-risk'
import {
  isBuriedLead,
  isDuplicateLowerSectionItem,
  recordPlacement,
  NEED_TO_KNOW_MAX,
} from './digest-section-rules'
import { emptyDigestContext, type DigestContext, type DigestItemRole, type DigestPullMetadata, type EditorialPullOverride } from './digest-pull-types'
import { evaluateLeadEligibility, type LeadEditorialOverride, type LeadEligibilityResult } from './lead-eligibility'
import { policyForStory, type SourcePolicy } from './source-policy'
import type { CanonicalDigestSectionName } from './digest-canonical'
import type { Story } from './types'

// Per-section caps for the from-pool assembly. Mirrors DIGEST_SECTION_LIMITS in
// digest-canonical.ts; kept here so this layer is self-contained and tunable.
export const POOL_SECTION_CAPS: Record<string, number> = {
  'Need To Know': NEED_TO_KNOW_MAX,
  'Politics & World Affairs': 4,
  'Science, Health & Environment': 2,
  'Business & Markets': 2,
  'Culture, Media & Society': 2,
  'Also Worth Knowing': 3,
  'Global Blindspot': 4,
}

const ROLE_TO_SECTION: Record<DigestItemRole, CanonicalDigestSectionName | null> = {
  lead: 'Need To Know',
  institutional_signal: 'Politics & World Affairs',
  developing_safety: 'Politics & World Affairs',
  practical_impact: 'Politics & World Affairs',
  economic_context: 'Business & Markets',
  health_science_context: 'Science, Health & Environment',
  cultural_texture: 'Culture, Media & Society',
  undercovered_global: 'Global Blindspot',
  reader_utility: 'Also Worth Knowing',
  mainstream_agenda_marker: null, // sourced from Mainstream Pulse, not the pool
  archive_only: null,
}

export interface PulledItem {
  story: Story
  section: CanonicalDigestSectionName
  pull: DigestPullMetadata
  caution: string | null
  isLead: boolean
}

export interface ExcludedItem {
  story: Story
  reason: string
  score: number
  role: DigestItemRole
}

// Lead-gate outcome surfaced for validation / debug (Task 5b).
export interface LeadDecision {
  slug: string
  status: 'eligible' | 'degraded' | 'held'
  failedGates: string[]   // reasons the chosen lead failed (empty when eligible)
  warning?: string
}

export interface CanonicalPullResult {
  needToKnow: PulledItem[]
  sections: Record<string, PulledItem[]>
  globalBlindspot: PulledItem[]
  excluded: ExcludedItem[]
  context: DigestContext
  leadDecision?: LeadDecision
  heldForReview?: boolean // Task 5b: every lead candidate was hard-blocked
}

export interface AssemblyOptions {
  policies?: Map<string, SourcePolicy>
  leadOverrides?: Map<string, LeadEditorialOverride>
}

export function buildCanonicalDigestFromStoryPool(
  stories: Story[],
  opts: AssemblyOptions = {}
): CanonicalPullResult {
  // Score everything locally first, then assemble in descending strength so the
  // strongest stories claim Need To Know and section slots before weaker ones.
  const scored = stories
    .map(story => ({ story, base: calculateDigestPullScore(story) }))
    .sort((a, b) => b.base.score - a.base.score)

  let context = emptyDigestContext()
  const needToKnow: PulledItem[] = []
  const sections: Record<string, PulledItem[]> = {}
  const globalBlindspot: PulledItem[] = []
  const excluded: ExcludedItem[] = []

  const exclude = (story: Story, role: DigestItemRole, score: number, reason: string) =>
    excluded.push({ story, role, score, reason })

  // Lead gate (Task 5): the FIRST Need To Know slot is the lead and must pass
  // hard eligibility. Stories that fail the lead gate are tracked so the
  // degraded-lead fallback (Task 5b) can choose among them when nothing is
  // cleanly eligible — rather than letting score alone seat a weak lead.
  let leadPlaced = false
  const leadGateOf = (story: Story): LeadEligibilityResult => evaluateLeadEligibility(story, {
    policy: opts.policies ? policyForStory(story, opts.policies) : undefined,
    override: opts.leadOverrides?.get(story.slug),
  })
  const degradedCandidates: Array<{ item: PulledItem; gate: LeadEligibilityResult }> = []
  const blockedLeadCandidates: Array<{ item: PulledItem; gate: LeadEligibilityResult }> = []

  for (const { story } of scored) {
    // Re-score WITH the running context so relational rules (duplicate-of-lead
    // demotion to archive_only) take effect.
    const result = calculateDigestPullScore(story, context)
    const { role, score, riskFlags } = result

    // Hard drops first ───────────────────────────────────────────────
    // Bundled multi-story: can't split from pool data, so never publish whole.
    if (detectBundledMultistory(story)) {
      exclude(story, role, score, 'bundled multi-story summary — split upstream before inclusion')
      continue
    }
    // State-affiliated high-stakes, uncorroborated + single-source → archive.
    const state = assessStateAffiliated(story)
    if (state.exclude) {
      exclude(story, role, score, 'state-affiliated high-stakes, uncorroborated single-source')
      continue
    }
    // Duplicate of the lead's topic with no distinct role → archive.
    if (isDuplicateLowerSectionItem(story, role, context)) {
      exclude(story, role, score, 'duplicates Need To Know topic without a distinct role')
      continue
    }
    // Below threshold with no lead role → archive.
    if (!meetsInclusionThreshold(result) && role !== 'lead') {
      exclude(story, role, score, result.pullReason)
      continue
    }

    const pull: DigestPullMetadata = {
      role,
      pullScore: score,
      pullReason: result.pullReason,
      riskFlags,
    }

    // Promote leads / lead-strength stories to Need To Know (respect the cap).
    const wantsNeedToKnow = role === 'lead' || score >= DIGEST_LEAD_STRENGTH
    if (wantsNeedToKnow && needToKnow.length < POOL_SECTION_CAPS['Need To Know']) {
      const item: PulledItem = { story, section: 'Need To Know', pull, caution: state.caution, isLead: !leadPlaced }

      // The lead slot is a hard gate (Task 5). A story that would take the lead
      // must pass it; otherwise it cannot seat as lead on score alone. Failed
      // candidates are held for the degraded-lead fallback below.
      if (!leadPlaced) {
        const gate = leadGateOf(story)
        if (gate.status === 'blocked') {
          blockedLeadCandidates.push({ item, gate })
          exclude(story, role, score, `lead-blocked: ${gate.reasons.join(' ')}`)
          continue
        }
        if (gate.status === 'override_required') {
          degradedCandidates.push({ item, gate })
          exclude(story, role, score, `lead-override-required: ${gate.reasons.join(' ')}`)
          continue
        }
        // eligible → seat as the lead.
        leadPlaced = true
      }

      needToKnow.push(item)
      context = recordPlacement(context, story, role, story.region, !item.isLead ? false : true)
      continue
    }

    // Otherwise route by role to its topic section.
    const section = ROLE_TO_SECTION[role]
    if (!section) {
      exclude(story, role, score, result.pullReason)
      continue
    }

    // Region integrity: a mismatched region blocks region-dependent sections.
    if (section === 'Global Blindspot' && hasRegionLabelMismatch(story)) {
      pull.riskFlags = [...(pull.riskFlags ?? []), 'region_label_mismatch']
      exclude(story, role, score, 'region label disagrees with outlet origin — corrected before Blindspot')
      continue
    }

    const cap = POOL_SECTION_CAPS[section] ?? Infinity
    const target = section === 'Global Blindspot'
      ? globalBlindspot
      : (sections[section] ??= [])
    if (target.length >= cap) {
      exclude(story, role, score, `${section} at cap (${cap}) — strongest kept, rest to archive`)
      continue
    }

    target.push({ story, section, pull, caution: state.caution, isLead: false })
    context = recordPlacement(context, story, role, story.region, false)
  }

  // Task 5: within Politics & World Affairs, order by role priority — an
  // institutional development leads over a practical-impact item, which leads
  // over developing safety — rather than by raw score alone. Stable within a
  // role (preserves the score-descending order already established above).
  const politics = sections['Politics & World Affairs']
  if (politics) {
    sections['Politics & World Affairs'] = [...politics].sort(
      (a, b) => POLITICS_ROLE_PRIORITY[a.pull.role] - POLITICS_ROLE_PRIORITY[b.pull.role]
    )
  }

  // ── Task 5b: degraded-lead fallback ──────────────────────────────────────
  // The digest must ship with a lead and must never be leadless or hard-error.
  let leadDecision: LeadDecision | undefined
  let heldForReview = false
  if (leadPlaced) {
    const lead = needToKnow.find(i => i.isLead)
    if (lead) leadDecision = { slug: lead.story.slug, status: 'eligible', failedGates: [] }
  } else if (degradedCandidates.length > 0) {
    // No fully eligible story today: lead with the STRONGEST override-required
    // candidate (degradedCandidates preserve score order), attach its caution,
    // and surface a prominent warning recording which gate(s) it failed.
    const { item, gate } = degradedCandidates[0]
    // Pull it back out of `excluded` and seat it as the (degraded) lead.
    const idx = excluded.findIndex(e => e.story.slug === item.story.slug)
    if (idx !== -1) excluded.splice(idx, 1)
    const degradedLead: PulledItem = { ...item, isLead: true }
    needToKnow.unshift(degradedLead)
    context = recordPlacement(context, item.story, item.pull.role, item.story.region, true)
    leadDecision = {
      slug: item.story.slug,
      status: 'degraded',
      failedGates: gate.reasons,
      warning: 'Lead chosen under degraded eligibility — no fully eligible story today.',
    }
  } else if (blockedLeadCandidates.length > 0) {
    // Everything that could lead is hard-blocked (restricted source / wrong
    // format). That means the pull itself failed — hold for review rather than
    // auto-publishing a blocked-source lead.
    heldForReview = true
    leadDecision = {
      slug: blockedLeadCandidates[0].item.story.slug,
      status: 'held',
      failedGates: blockedLeadCandidates[0].gate.reasons,
      warning: 'No story passed the lead gate and all lead candidates are blocked — hold for review.',
    }
  }

  // ── Task 5: corroboration-aware Need To Know ordering ────────────────────
  // The lead slot is chosen by the eligibility gate above and stays pinned at
  // the top. Among the REMAINING Need To Know items, order by corroboration
  // first — a broadly-covered story must never sit below a suspect/low-coverage
  // "developing" item (the live inversion). "Developing"/"emerging" is a label,
  // not a ranking boost over genuine corroboration.
  const leadItem = needToKnow.find(i => i.isLead)
  const rest = needToKnow.filter(i => !i.isLead).sort(compareNeedToKnowByCorroboration)
  const orderedNeedToKnow = leadItem ? [leadItem, ...rest] : rest

  return { needToKnow: orderedNeedToKnow, sections, globalBlindspot, excluded, context, leadDecision, heldForReview }
}

// Task 5 ordering key for Need To Know (excluding the gated lead slot):
//   1. corroboration tier — corroborated/high-coverage (>=5) outranks suspect or
//      low-coverage; suspect coverage is treated as the weakest tier.
//   2. verified coverage breadth (a suspect count contributes 0).
//   3. impact — the pull score as a proxy.
//   4. recency.
export function compareNeedToKnowByCorroboration(a: PulledItem, b: PulledItem): number {
  const tierA = corroborationTier(a)
  const tierB = corroborationTier(b)
  if (tierA !== tierB) return tierB - tierA

  const covA = verifiedCoverage(a)
  const covB = verifiedCoverage(b)
  if (covA !== covB) return covB - covA

  if (a.pull.pullScore !== b.pull.pullScore) return b.pull.pullScore - a.pull.pullScore

  const tA = a.story.created_at ? Date.parse(a.story.created_at) : 0
  const tB = b.story.created_at ? Date.parse(b.story.created_at) : 0
  return tB - tA
}

// Higher tier = stronger corroboration. A suspect-coverage item is forced to the
// weakest tier regardless of its (untrusted) count.
function corroborationTier(item: PulledItem): number {
  if (item.pull.riskFlags?.includes('coverage_suspect')) return 0
  const covered = item.story.msm_outlet_coverage?.covered?.length ?? 0
  if (covered >= 5) return 3
  if (covered >= 2) return 2
  return 1
}

function verifiedCoverage(item: PulledItem): number {
  if (item.pull.riskFlags?.includes('coverage_suspect')) return 0
  return item.story.msm_outlet_coverage?.covered?.length ?? 0
}

// Task 5 selection/ordering priority for Politics & World Affairs. Roles not
// listed (shouldn't reach this section via ROLE_TO_SECTION) sort last.
const POLITICS_ROLE_PRIORITY: Record<DigestItemRole, number> = {
  institutional_signal: 0,
  practical_impact: 1,
  developing_safety: 2,
  undercovered_global: 3,
  lead: 4,
  economic_context: 4,
  health_science_context: 4,
  cultural_texture: 4,
  reader_utility: 4,
  mainstream_agenda_marker: 4,
  archive_only: 4,
}

// Task 15 — editorial override. Strict by default; an admin can force an
// inclusion (or relocate/relabel an already-included item) with a reason.
// Cannot suppress state-affiliated caution (Task 7): the caution is preserved
// and merged with any override-supplied caution rather than replaced.
export function applyEditorialOverrides(
  result: CanonicalPullResult,
  overrides: Map<string, EditorialPullOverride>
): CanonicalPullResult {
  if (overrides.size === 0) return result

  const needToKnow = [...result.needToKnow]
  const sections: Record<string, PulledItem[]> = {}
  for (const [name, items] of Object.entries(result.sections)) sections[name] = [...items]
  const globalBlindspot = [...result.globalBlindspot]
  const excluded = [...result.excluded]

  for (const [slug, override] of overrides) {
    if (!override.reason) continue

    if (override.include) {
      const excludedIndex = excluded.findIndex(e => e.story.slug === slug)
      if (excludedIndex === -1) continue
      const [dropped] = excluded.splice(excludedIndex, 1)
      const role = override.role ?? dropped.role
      const targetSection = (override.section as CanonicalDigestSectionName | undefined) ?? ROLE_TO_SECTION[role] ?? 'Also Worth Knowing'
      const state = assessStateAffiliated(dropped.story)
      const caution = [state.caution, override.caution].filter(Boolean).join(' ') || null
      const pull: DigestPullMetadata = {
        role,
        pullScore: dropped.score,
        pullReason: `${dropped.reason} — editorial override: ${override.reason}`,
        riskFlags: state.flagged ? ['state_affiliated_high_stakes'] : [],
      }
      const item: PulledItem = { story: dropped.story, section: targetSection, pull, caution, isLead: targetSection === 'Need To Know' }
      if (targetSection === 'Need To Know') needToKnow.push(item)
      else if (targetSection === 'Global Blindspot') globalBlindspot.push(item)
      else (sections[targetSection] ??= []).push(item)
      continue
    }

    // Relocate/relabel an already-placed item without changing its inclusion.
    const relocate = (items: PulledItem[]): PulledItem[] => items.map(item => {
      if (item.story.slug !== slug) return item
      const role = override.role ?? item.pull.role
      const pull: DigestPullMetadata = { ...item.pull, role, pullReason: `${item.pull.pullReason} — editorial override: ${override.reason}` }
      const caution = [item.caution, override.caution].filter(Boolean).join(' ') || null
      return { ...item, pull, caution, section: (override.section as CanonicalDigestSectionName | undefined) ?? item.section }
    })
    for (const name of Object.keys(sections)) sections[name] = relocate(sections[name])
  }

  return { needToKnow, sections, globalBlindspot, excluded, context: result.context }
}

// Relational validation that depends on the assembled pull (the reasoning-heavy
// checks). Mechanical per-item checks live in lib/digest-canonical.ts /
// digest-validation.ts (Task 16).
export interface PullValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateCanonicalPull(result: CanonicalPullResult): PullValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (result.needToKnow.length === 0 && !result.heldForReview) errors.push('Need To Know is empty')
  if (result.needToKnow.length === 1) warnings.push('Need To Know has only 1 item (expected 2–3)')

  // Lead-gate outcome (Task 5b): degraded lead is a prominent warning; an
  // all-blocked hold is a critical error (the pull itself failed).
  if (result.leadDecision?.status === 'degraded') {
    warnings.push(`${result.leadDecision.warning} Failed gate(s): ${result.leadDecision.failedGates.join(' ')}`)
  }
  if (result.heldForReview || result.leadDecision?.status === 'held') {
    errors.push(result.leadDecision?.warning ?? 'No eligible lead — hold for review.')
  }

  // Buried lead (critical): a lead-strength story landed outside Need To Know.
  for (const items of Object.values(result.sections)) {
    for (const item of items) {
      if (isBuriedLead(item.pull.role, item.pull.pullScore, false)) {
        errors.push(`Buried lead: ${item.story.slug} is lead-strength but placed in ${item.section}`)
      }
    }
  }

  // Politics density cap.
  const politics = result.sections['Politics & World Affairs'] ?? []
  if (politics.length > POOL_SECTION_CAPS['Politics & World Affairs']) {
    warnings.push(`Politics & World Affairs exceeds cap (${politics.length}/${POOL_SECTION_CAPS['Politics & World Affairs']})`)
  }

  // State-affiliated high-stakes items must carry caution.
  const allPlaced = [...result.needToKnow, ...Object.values(result.sections).flat(), ...result.globalBlindspot]
  for (const item of allPlaced) {
    if (item.pull.riskFlags?.includes('state_affiliated_high_stakes') && !item.caution) {
      errors.push(`State-affiliated high-stakes item lacks caution: ${item.story.slug}`)
    }
    if (item.pull.riskFlags?.includes('bundled_multistory')) {
      errors.push(`Bundled multi-story item was placed: ${item.story.slug}`)
    }
  }

  // Blindspot regional diversity (set-level): warn if all share one region.
  if (result.globalBlindspot.length >= 3) {
    const regions = new Set(result.globalBlindspot.map(i => i.story.region ?? 'unknown'))
    if (regions.size === 1) warnings.push('Global Blindspot lacks regional diversity (all one region)')
  }

  return { errors, warnings }
}

// Debug view for the QA command (Task 17) — sorted scores with the cut line.
export function pullScoreDistribution(result: CanonicalPullResult): Array<{ slug: string; score: number; role: DigestItemRole; included: boolean }> {
  const included = [...result.needToKnow, ...Object.values(result.sections).flat(), ...result.globalBlindspot]
    .map(i => ({ slug: i.story.slug, score: i.pull.pullScore, role: i.pull.role, included: true }))
  const excluded = result.excluded.map(e => ({ slug: e.story.slug, score: e.score, role: e.role, included: false }))
  return [...included, ...excluded].sort((a, b) => b.score - a.score)
}
