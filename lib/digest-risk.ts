// Source-risk safeguards for the canonical digest.
//
//   Task 7  — state-affiliated high-stakes geopolitical claims
//   Task 7b — region-label integrity (delegated to digest-outlet-region)
//   Task 6b — bundled multi-story items (one entry must be one story)

import { getConfidenceLabel } from './confidence'
import { coverageCount } from './feed-editorial'
import { hasRegionLabelMismatch } from './digest-outlet-region'
import type { Story } from './types'

export const STATE_AFFILIATED_CAUTION =
  'Details come from a state-affiliated outlet and should be read alongside independent confirmation.'

export const STATE_AFFILIATED_CAUTION_BADGE = 'Use with caution'

// High-stakes topics where a state outlet's incentive to shape the narrative
// matters most: geopolitics, military, migration, war, diplomacy. Matched with
// word boundaries so e.g. "award" doesn't trip "war"; stems (diplomac, migrat)
// intentionally omit the trailing boundary to catch inflections.
const HIGH_STAKES_PATTERN =
  /\b(wars?|warhead|military|missiles?|strikes?|airstrikes?|troops?|forces|invasions?|nuclear|ceasefires?|truce|diplomac\w*|diplomat\w*|sanctions?|negotiat\w*|migrant\w*|migration|asylum|refugees?|sovereignty|annex\w*|occupation|offensive|militi\w*|militants?|insurgen\w*|coup|regime|geopolit\w*|treaty|hostages?|drones?|warships?|naval|blockade|incursion|shelling|bombard\w*|frontlines?)\b/i

function storyText(story: Pick<Story, 'title' | 'description' | 'subcategory'>): string {
  return `${story.title ?? ''} ${story.description ?? ''} ${story.subcategory ?? ''}`
}

export function isHighStakesGeopolitical(
  story: Pick<Story, 'title' | 'description' | 'subcategory'>
): boolean {
  return HIGH_STAKES_PATTERN.test(storyText(story))
}

// State-affiliated: explicit source_type, or tier >= 8 (the tier band where
// State Media lands — see lib/ingest/source-tier.ts).
export function isStateAffiliated(
  story: Pick<Story, 'source_type' | 'source_tier'>
): boolean {
  const type = (story.source_type ?? '').toLowerCase()
  if (type.includes('state-affiliated') || type.includes('state media') || type.includes('state affiliated')) {
    return true
  }
  return (story.source_tier ?? 0) >= 8
}

type CorroborationStory = Parameters<typeof getConfidenceLabel>[0] & Pick<Story, 'msm_outlet_coverage'>

// Corroborated = independently confirmed by enough outlets. Distinct from the
// caution decision: corroboration earns a place, caution stays regardless.
export function isCorroborated(story: CorroborationStory): boolean {
  return getConfidenceLabel(story) === 'CORROBORATED' || coverageCount(story) >= 5
}

export function isSingleSource(story: CorroborationStory): boolean {
  const label = getConfidenceLabel(story)
  if (label === 'SINGLE-SOURCE') return true
  return coverageCount(story) <= 1
}

export interface StateAffiliatedAssessment {
  flagged: boolean        // is this a state-affiliated high-stakes item at all
  caution: string | null  // caution copy to display (shown even when corroborated)
  exclude: boolean        // must be dropped (uncorroborated single-source)
}

// Task 7. Caution and corroboration are independent:
//   - flagged → caution ALWAYS shown (it's about the source's incentive).
//   - uncorroborated AND single-source → exclude (caution alone isn't enough).
//   - corroborated → eligible for inclusion, caution still shown.
export function assessStateAffiliated(
  story: Pick<Story, 'source_type' | 'source_tier' | 'title' | 'description' | 'subcategory' | 'category' | 'msm_gap'> & CorroborationStory
): StateAffiliatedAssessment {
  if (!(isStateAffiliated(story) && isHighStakesGeopolitical(story))) {
    return { flagged: false, caution: null, exclude: false }
  }
  const exclude = !isCorroborated(story) && isSingleSource(story)
  return { flagged: true, caution: STATE_AFFILIATED_CAUTION, exclude }
}

// ── Task 6b: bundled multi-story detection ──────────────────────────────────
//
// A single digest entry must cover a single story. We detect the joining
// patterns that stitch two unrelated events into one summary. This is a
// validation backstop; the generation step should also refuse to bundle.

const BUNDLE_JOINERS = [
  /\bseparately\b/i,
  /\bmeanwhile\b/i,
  /\bin other news\b/i,
  /\bin unrelated news\b/i,
  /\belsewhere\b,/i,
  /\balso(?:,| reported| this week)\b/i,
  /;\s*(?:and\s+)?in\b/i,
]

export function detectBundledMultistory(
  story: Pick<Story, 'description'> | { summary?: string | null; description?: string | null }
): boolean {
  const text = 'summary' in story ? (story.summary ?? story.description ?? '') : (story.description ?? '')
  return detectBundledText(text)
}

export function detectBundledText(text: string | null | undefined): boolean {
  if (!text) return false
  return BUNDLE_JOINERS.some(re => re.test(text))
}

// Re-export region integrity for callers that pull "all risk" from one module.
export { hasRegionLabelMismatch }
