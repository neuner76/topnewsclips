// Local Blindspot engine (Task 12) — a consequential local event or public-record
// change with little/no local-media coverage. Ranks candidates by blindspotScore
// (consequence + relevance + novelty, minus a coverage penalty). Requires a
// primary source and never speculates.
//
// v1 note: the coverage detector needs the local media registry (Build C). Until
// then callers pass localMediaOutlets = 0, so blindspots are surfaced by
// consequence with the honest "0 tracked local outlets" framing. The LocalCoverage
// Detector type documents the Build-C plug-in point.
import { blindspotScore } from './scoring'
import type { LocalEvent } from './types'

// Build C: match an event against the local source registry (published within
// 7 days either side of firstSeenAt, matching 2+ of: entity, address/APN, dollar
// ±5%, agenda-item title fuzzy >= 0.8, or geocoded point within 0.25 mi) and
// return the matched-outlet count. See Decisions › Local media coverage detector.
export type LocalCoverageDetector = (event: LocalEvent) => Promise<number>

// Matched outlets -> [0, 1]. Display the raw count, never the score.
export function localMediaCoverageScore(matchedOutlets: number): number {
  return Math.min(matchedOutlets / 3, 1)
}

export interface BlindspotInput {
  event: LocalEvent
  localMediaOutlets: number // from the coverage detector; 0 in v1
  novelty?: number
}

export interface LocalBlindspot {
  event: LocalEvent
  score: number
  localMediaOutlets: number
}

const PRIMARY_SOURCE_TYPES = new Set(['public_record', 'official_alert'])

export function selectLocalBlindspots(
  inputs: BlindspotInput[],
  opts: { minScore?: number; minConsequence?: number; limit?: number } = {}
): LocalBlindspot[] {
  const minScore = opts.minScore ?? 0.3
  const minConsequence = opts.minConsequence ?? 0.3
  const scored = inputs
    // Primary source required — never surface a blindspot on commentary/rumor.
    .filter(i => i.event.sources.some(s => PRIMARY_SOURCE_TYPES.has(s.type)))
    // Must be genuinely consequential — relevance/novelty alone are not a blindspot.
    .filter(i => i.event.consequenceScore >= minConsequence)
    .map(i => ({
      event: i.event,
      localMediaOutlets: i.localMediaOutlets,
      score: blindspotScore({
        consequence: i.event.consequenceScore,
        localRelevance: i.event.relevanceScore ?? 1, // v1: Marin-wide candidates treated as relevant
        novelty: i.novelty ?? (i.event.status === 'new' ? 1 : 0.5),
        localMediaCoverage: localMediaCoverageScore(i.localMediaOutlets),
      }),
    }))
    .filter(b => b.score >= minScore)
    .sort((a, b) => b.score - a.score)
  return opts.limit != null ? scored.slice(0, opts.limit) : scored
}
