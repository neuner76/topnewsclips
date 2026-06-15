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

  return { needToKnow, sections, globalBlindspot, excluded, context }
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
