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
import { digestTopicKey } from './digest-role-classifier'
import { evaluateLeadEligibility } from './lead-eligibility'
import { isBuriedLead, isDuplicateLowerSectionItem, recordPlacement, NEED_TO_KNOW_MIN, NEED_TO_KNOW_MAX } from './digest-section-rules'
import { validateGlobalLensSourceConsistency } from './feed-editorial'
import { emptyDigestContext, type DigestItemRole, type DigestRiskFlag } from './digest-pull-types'
import type { CanonicalDigestItem, DigestEdition } from './digest-canonical'
import type { Story } from './types'

// Task 12 — Global Blindspot holds the strongest 3, 4 at most.
const GLOBAL_BLINDSPOT_MIN = 3
const GLOBAL_BLINDSPOT_MAX = 4

// Task 13 — Global Lens stays concise: 2-3 items.
const GLOBAL_LENS_MIN = 2
const GLOBAL_LENS_MAX = 3

// Task 11 — mainstream sections where a 0-of-N story needs a label/justification.
const MAINSTREAM_SECTIONS = new Set([
  'Politics & World Affairs',
  'Science, Health & Environment',
  'Business & Markets',
  'Culture, Media & Society',
])

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

  // Need To Know bounds (Task 4b).
  if (edition.needToKnow.length < NEED_TO_KNOW_MIN) {
    warnings.push(`Need To Know has ${edition.needToKnow.length} items (expected ${NEED_TO_KNOW_MIN}–${NEED_TO_KNOW_MAX})`)
  }
  if (edition.needToKnow.length > NEED_TO_KNOW_MAX) {
    warnings.push(`Need To Know has ${edition.needToKnow.length} items (cap ${NEED_TO_KNOW_MAX})`)
  }

  // Lead eligibility (Tasks 2–5) on the live edition's first NTK item. Policy
  // gates (restricted source) are enforced in from-pool assembly where the
  // table is loaded; here we apply the non-policy gates (content type, tier,
  // corroboration, consequence) that catch a weak-format lead like the
  // motivating Commentary/Analysis T7 2-of-14 case.
  const leadStory = edition.needToKnow[0] ? storyMap.get(edition.needToKnow[0].id) : undefined
  if (leadStory) {
    const gate = evaluateLeadEligibility(leadStory)
    if (gate.status === 'blocked') {
      errors.push(`Lead is ineligible: ${gate.reasons.join(' ')} (${edition.needToKnow[0].id})`)
    } else if (gate.status === 'override_required') {
      warnings.push(`Lead requires editorial override: ${gate.reasons.join(' ')} (${edition.needToKnow[0].id})`)
    }
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

    // Duplicate-of-lead topic without a distinct role (Task 6). Not applicable
    // to Need To Know items — they ARE the front page.
    const isDuplicate = !inNeedToKnow && isDuplicateLowerSectionItem(story, result.role, context)
    if (isDuplicate) {
      warnings.push(`${item.section} item duplicates Need To Know topic without a distinct role: ${item.id}`)
    }

    // Merely-interesting: placed but lacks any digest role. Skipped for Need To
    // Know (those are leads by placement) and for items already flagged as a
    // duplicate-of-lead (the duplicate IS the reason — no need to double-warn).
    // A low score with a real role (cultural_texture, undercovered_global) is an
    // allowed exception per the spec and is not warned here.
    if (!inNeedToKnow && !isDuplicate && result.role === 'archive_only') {
      warnings.push(`${item.section} item is interesting but lacks a clear digest role (score ${result.score}): ${item.id}`)
    }

    // Raw footage should not define Science, Health & Environment (Task 8) —
    // it belongs there only when reframed with stronger health/climate context.
    if (item.section === 'Science, Health & Environment' && flags.includes('raw_footage_primary')) {
      warnings.push(`Raw footage defines Science, Health & Environment: ${item.id}`)
    }

    // Undercovered story in a mainstream section (Task 11): a 0-of-N item needs
    // a label (Limited Coverage / Emerging signal), a routing to Global
    // Blindspot, or an editorial reason — otherwise it's an unjustified pull.
    if (MAINSTREAM_SECTIONS.has(item.section) && (item.metadata.coverageCount ?? 0) === 0) {
      const caution = (item.metadata.caution ?? '').toLowerCase()
      const labeled = caution.includes('limited') || caution.includes('emerging') || caution.includes('undercovered')
      if (!labeled) {
        warnings.push(`0-of-${item.metadata.coverageTotal ?? 15} story appears in ${item.section}; add Emerging Signal/Limited Coverage treatment, route to Global Blindspot, or provide editorial reason: ${item.id}`)
      }
    }

    // Satire/cultural items must show "Cultural lens", never a news confidence
    // label, even once routed through pull-quality role classification (Task 10).
    if (result.role === 'cultural_texture' && item.metadata.confidence && item.metadata.confidence !== 'Cultural lens') {
      warnings.push(`Cultural texture item should show "Cultural lens", not "${item.metadata.confidence}": ${item.id}`)
    }

    // Country-only label (Task 16): a Blindspot/Lens item with no identifiable
    // outlet/journalist falls back to a bare region/country label, which is a
    // weaker source attribution than `country_label_without_outlet` describes.
    if ((item.section === 'Global Blindspot' || item.section === 'Global Lens') &&
      !item.metadata.source && !item.metadata.handle && story.region && story.region !== 'World') {
      flags.push('country_label_without_outlet')
      warnings.push(`${item.section} item has no outlet, only a country/region label: ${item.id}`)
    }

    annotations.push({ id: item.id, section: item.section, role: result.role, score: result.score, riskFlags: flags })
  }

  // Need To Know first, evaluated incrementally: each item is scored against the
  // context of PRIOR placements only (so the lead is never compared to itself),
  // then recorded so lower sections can be measured against the lead's topic.
  for (const ntk of edition.needToKnow) {
    evaluate(ntk, true)

    // World view lens same-event check (Task 7b): a lens annotating this lead
    // must cover the SAME core event/topic, never a downstream consequence or
    // an adjacent topic (e.g. an ECB rate story beside an Iran lead).
    const leadStory = storyMap.get(ntk.id)
    const leadTopic = leadStory ? digestTopicKey(leadStory) : null
    for (const world of ntk.worldView) {
      const worldStory = storyMap.get(world.id)
      if (!leadTopic || !worldStory) continue
      if (digestTopicKey(worldStory) !== leadTopic) {
        errors.push(`World view lens covers a different event than its lead "${ntk.id}": ${world.id}`)
      }
    }

    if (leadStory) {
      const { role } = calculateDigestPullScore(leadStory, context)
      context = recordPlacement(context, leadStory, role, leadStory.region, true)
    }
  }
  for (const section of edition.sections) {
    for (const item of section.items) evaluate(item, false)
  }
  for (const item of edition.globalBlindspot) evaluate(item, false)
  for (const item of edition.globalLens) evaluate(item, false)

  // Global Blindspot bounds (Task 12): the strongest 3, 4 at most.
  if (edition.globalBlindspot.length > GLOBAL_BLINDSPOT_MAX) {
    warnings.push(`Global Blindspot has ${edition.globalBlindspot.length} items (cap ${GLOBAL_BLINDSPOT_MAX})`)
  } else if (edition.globalBlindspot.length > 0 && edition.globalBlindspot.length < GLOBAL_BLINDSPOT_MIN) {
    warnings.push(`Global Blindspot has ${edition.globalBlindspot.length} items (expected ${GLOBAL_BLINDSPOT_MIN}-${GLOBAL_BLINDSPOT_MAX})`)
  }

  // Global Lens bounds (Task 13): 2-3 concise items.
  if (edition.globalLens.length > GLOBAL_LENS_MAX) {
    warnings.push(`Global Lens has ${edition.globalLens.length} items (cap ${GLOBAL_LENS_MAX})`)
  } else if (edition.globalLens.length > 0 && edition.globalLens.length < GLOBAL_LENS_MIN) {
    warnings.push(`Global Lens has ${edition.globalLens.length} items (expected ${GLOBAL_LENS_MIN}-${GLOBAL_LENS_MAX})`)
  }

  // Global Lens: no duplicate base-story summaries, and outlet name must match
  // the summary text (Task 13).
  const seenLensIds = new Set<string>()
  for (const item of edition.globalLens) {
    if (seenLensIds.has(item.id)) {
      warnings.push(`Global Lens duplicates base-story summary: ${item.id}`)
    }
    seenLensIds.add(item.id)

    const story = storyMap.get(item.id)
    const consistency = validateGlobalLensSourceConsistency({ summary: item.summary }, story ?? null)
    if (!consistency.valid) {
      warnings.push(`Global Lens source inconsistency for ${item.id}: ${consistency.reason}`)
    }
  }

  // Thin-digest check (Task 15). One-item sections are fine when the digest is
  // intentionally concise; the smell is MANY of them at once, which reads as
  // under-filled. Warn only when 3+ primary sections each hold exactly one item.
  const oneItemSections = edition.sections.filter(s => s.items.length === 1)
  if (oneItemSections.length >= 3) {
    warnings.push(`Digest may be under-filled: ${oneItemSections.length} primary sections contain only one qualifying item (${oneItemSections.map(s => s.name).join(', ')}). Review story pool or merge weak sections.`)
  }

  return { warnings, errors, annotations }
}
