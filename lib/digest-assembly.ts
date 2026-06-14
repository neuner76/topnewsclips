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
import { emptyDigestContext, type DigestContext, type DigestItemRole, type DigestPullMetadata } from './digest-pull-types'
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

export interface CanonicalPullResult {
  needToKnow: PulledItem[]
  sections: Record<string, PulledItem[]>
  globalBlindspot: PulledItem[]
  excluded: ExcludedItem[]
  context: DigestContext
}

export function buildCanonicalDigestFromStoryPool(stories: Story[]): CanonicalPullResult {
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
      const item: PulledItem = { story, section: 'Need To Know', pull, caution: state.caution, isLead: true }
      needToKnow.push(item)
      context = recordPlacement(context, story, role, story.region, true)
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

  return { needToKnow, sections, globalBlindspot, excluded, context }
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

  if (result.needToKnow.length === 0) errors.push('Need To Know is empty')
  if (result.needToKnow.length === 1) warnings.push('Need To Know has only 1 item (expected 2–3)')

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
