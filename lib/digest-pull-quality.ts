// Phase 1 integration (warn-only) — pull-quality checks that run ALONGSIDE the
// existing presentation validator (validateDigestEdition), not in place of it.
//
// The live digest is selected and written by the LLM in generateAndStoreDigest
// and mapped to a single canonical DigestEdition by buildDigestEdition. This
// module does NOT re-select. It annotates that one edition with role / score /
// risk metadata and surfaces relational defects (buried lead, duplicate topic,
// region mismatch, missing state-affiliated caution, bundled summaries) as
// warnings/errors so they can be reviewed before pre-filtering is trusted to
// remove candidates upstream.
//
// Kept in a separate file so it never collides with the presentation layer.

import {
  assessStateAffiliated,
  detectBundledText,
  hasRegionLabelMismatch,
} from './digest-risk'
import { calculateDigestPullScore } from './digest-pull-score'
import { isBuriedLead, isDuplicateLowerSectionItem, recordPlacement, NEED_TO_KNOW_MIN, NEED_TO_KNOW_MAX } from './digest-section-rules'
import { emptyDigestContext, type DigestItemRole, type DigestRiskFlag } from './digest-pull-types'
import type { CanonicalDigestItem, DigestEdition } from './digest-canonical'
import type { Story } from './types'

export interface PullAnnotation {
  id: string
  section: string
  role: DigestItemRole
  score: number
  riskFlags: DigestRiskFlag[]
}

export interface PullQualityReport {
  warnings: string[]
  errors: string[]
  annotations: PullAnnotation[]
}

// The caution stored on an item's metadata only covers limited-coverage today;
// a state-affiliated high-stakes item needs an explicit source-incentive note.
function metadataMentionsStateCaution(item: CanonicalDigestItem): boolean {
  const c = (item.metadata.caution ?? '').toLowerCase()
  return c.includes('state') || c.includes('caution')
}

export function validateDigestPullQuality(
  edition: DigestEdition,
  storyMap: Map<string, Story>
): PullQualityReport {
  const warnings: string[] = []
  const errors: string[] = []
  const annotations: PullAnnotation[] = []

  // Build context from Need To Know first so lower sections can be measured
  // against the lead's topic (duplicate-topic suppression).
  let context = emptyDigestContext()
  for (const ntk of edition.needToKnow) {
    const story = storyMap.get(ntk.id)
    if (!story) continue
    const { role } = calculateDigestPullScore(story, context)
    context = recordPlacement(context, story, role, story.region, true)
  }

  // Need To Know bounds (Task 4b).
  if (edition.needToKnow.length < NEED_TO_KNOW_MIN) {
    warnings.push(`Need To Know has ${edition.needToKnow.length} items (expected ${NEED_TO_KNOW_MIN}–${NEED_TO_KNOW_MAX})`)
  }
  if (edition.needToKnow.length > NEED_TO_KNOW_MAX) {
    warnings.push(`Need To Know has ${edition.needToKnow.length} items (cap ${NEED_TO_KNOW_MAX})`)
  }

  const evaluate = (item: CanonicalDigestItem, inNeedToKnow: boolean) => {
    const story = storyMap.get(item.id)
    if (!story) return // mainstream-pulse / non-story items carry no pull metadata
    const result = calculateDigestPullScore(story, context)
    const flags = [...result.riskFlags]

    // Bundled summary (Task 6b) — check the rendered summary too, since the LLM
    // may have stitched events even when the source description didn't.
    if (detectBundledText(item.summary)) {
      if (!flags.includes('bundled_multistory')) flags.push('bundled_multistory')
      errors.push(`Bundled multi-story summary in ${item.section}: ${item.id}`)
    }

    // Region integrity (Task 7b).
    if (hasRegionLabelMismatch(story)) {
      flags.push('region_label_mismatch')
      errors.push(`Region label disagrees with outlet origin: ${item.id} (region "${story.region}")`)
    }

    // State-affiliated high-stakes caution (Task 7) — required even when
    // corroborated; only an outright exclusion is unflagged.
    const state = assessStateAffiliated(story)
    if (state.flagged && !metadataMentionsStateCaution(item)) {
      warnings.push(`State-affiliated high-stakes item should carry caution: ${item.id}`)
    }

    // Global Blindspot coverage criterion (Task 12) — the section is for
    // genuinely undercovered stories (≤2 US outlets). A broadly covered story
    // here is misplaced; that is a more precise complaint than "buried lead",
    // so it takes precedence for Blindspot items.
    const inBlindspot = item.section === 'Global Blindspot'
    if (inBlindspot && (item.metadata.coverageCount ?? 0) > 2) {
      warnings.push(`Global Blindspot item is broadly covered (${item.metadata.coverageCount} outlets) — does not meet the ≤2 undercovered criterion: ${item.id}`)
    }

    // Buried lead (Task 4b, critical) — a front-page-role story at lead strength
    // placed below Need To Know. Skipped for Global Blindspot (handled by the
    // coverage criterion above) since an undercovered global story legitimately
    // lives there.
    if (!inBlindspot && isBuriedLead(result.role, result.score, inNeedToKnow)) {
      errors.push(`Buried lead: ${item.id} is lead-strength (${result.score}, ${result.role}) but in ${item.section}`)
    }

    // Duplicate-of-lead topic without a distinct role (Task 6).
    if (!inNeedToKnow && isDuplicateLowerSectionItem(story, result.role, context)) {
      warnings.push(`${item.section} item duplicates Need To Know topic without a distinct role: ${item.id}`)
    }

    // Merely-interesting: placed but lacks any digest role. (A low score with a
    // real role — cultural_texture, undercovered_global — is an allowed
    // exception per the spec, so it is NOT warned here.)
    if (result.role === 'archive_only') {
      warnings.push(`${item.section} item is interesting but lacks a clear digest role (score ${result.score}): ${item.id}`)
    }

    annotations.push({ id: item.id, section: item.section, role: result.role, score: result.score, riskFlags: flags })
  }

  for (const ntk of edition.needToKnow) evaluate(ntk, true)
  for (const section of edition.sections) {
    for (const item of section.items) evaluate(item, false)
  }
  for (const item of edition.globalBlindspot) evaluate(item, false)

  return { warnings, errors, annotations }
}
