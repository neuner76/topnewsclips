// Phase 2 — conservative candidate-pool pre-filter (runs BEFORE the LLM).
//
// The LLM remains the selector and writer. This only raises the floor of what
// it can choose from by removing items that are individually, unambiguously
// unfit — never relational/editorial calls (caps, duplicate-of-lead), which
// need the LLM's context. Deliberately narrow: it is far worse to starve the
// LLM of a usable story than to let one weak item through (the warn-only
// quality layer catches those downstream).
//
// Intended to run in SHADOW MODE first (log would-remove, don't remove) so the
// floor can be proven against real generations before it is allowed to act.

import { calculateDigestPullScore } from './digest-pull-score'
import { assessStateAffiliated } from './digest-risk'
import type { Story } from './types'

// The pre-filter reads only these fields; cappedStories in digest.ts is a
// narrower row than Story (e.g. no subcategory), so accept a structural subset.
export type PrefilterCandidate = Pick<
  Story,
  | 'slug' | 'title' | 'description' | 'category'
  | 'source_tier' | 'source_type' | 'msm_outlet_coverage' | 'msm_gap'
  | 'journalist_username' | 'source' | 'region'
> & { subcategory?: string | null }

export interface PrefilterRemoval {
  slug: string
  reason: string
}

export interface PrefilterResult<T> {
  kept: T[]
  removed: PrefilterRemoval[]
}

// Score below which an archive_only item is considered unambiguous junk. Kept
// conservative: tuning showed legitimate content sits at >= 0, and Also Worth
// Knowing legitimately holds low-score "visual moments", so only clearly
// negative archive_only items are floor-removed.
export const PREFILTER_ARCHIVE_FLOOR = 0

export function prefilterCandidatePool<T extends PrefilterCandidate>(
  stories: T[],
  opts: { archiveFloor?: number } = {}
): PrefilterResult<T> {
  const archiveFloor = opts.archiveFloor ?? PREFILTER_ARCHIVE_FLOOR
  const kept: T[] = []
  const removed: PrefilterRemoval[] = []

  for (const s of stories) {
    const story = s as unknown as Story

    // Task 7 hard rule (safety): a state-affiliated high-stakes claim that is
    // uncorroborated AND single-source must not be auto-pulled. Unambiguous.
    if (assessStateAffiliated(story).exclude) {
      removed.push({ slug: s.slug, reason: 'state-affiliated high-stakes, uncorroborated single-source' })
      continue
    }

    const { role, score, riskFlags } = calculateDigestPullScore(story)

    // Lightweight human-interest with no broader role — the "adorable puppy goes
    // viral" class. Unambiguous archive material.
    if (role === 'archive_only' && riskFlags.includes('lightweight_human_interest')) {
      removed.push({ slug: s.slug, reason: `lightweight human-interest, no digest role (score ${score})` })
      continue
    }

    // Clearly-negative archive_only — junk by any reading.
    if (role === 'archive_only' && score < archiveFloor) {
      removed.push({ slug: s.slug, reason: `no digest role, score ${score} below floor ${archiveFloor}` })
      continue
    }

    kept.push(s)
  }

  return { kept, removed }
}
