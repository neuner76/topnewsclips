// TopNewsClips Local — consequence + blindspot scoring (pure).
//
// Every input is a float in [0, 1]; every formula is a weighted sum reading its
// weights from lib/local/scoring.config.ts (no hardcoded weights). See
// Decisions › Scoring.

import { SCORING_WEIGHTS, CONFIDENCE_SCORE } from './scoring.config'
import type { Confidence } from './types'

export function confidenceToNumber(confidence: Confidence): number {
  return CONFIDENCE_SCORE[confidence]
}

// Point proximity: 1 at the saved place, falling linearly to 0 at the radius,
// clamped to [0, 1]. Polygon containment (scored 1.0) is handled in the geography
// layer / PostGIS, not here. A non-positive radius yields 0 (nothing to measure).
export function proximityScore(distanceMiles: number, radiusMiles: number): number {
  if (!(radiusMiles > 0)) return 0
  return 1 - Math.min(distanceMiles / radiusMiles, 1)
}

export interface ConsequenceInputs {
  severity: number
  peopleAffected: number
  proximity: number
  immediacy: number
  duration: number
  institutionalImpact: number
  personalRelevance: number
  confidence: number
}

export function localConsequence(inputs: ConsequenceInputs): number {
  const w = SCORING_WEIGHTS.localConsequence
  return (
    w.severity * inputs.severity +
    w.peopleAffected * inputs.peopleAffected +
    w.proximity * inputs.proximity +
    w.immediacy * inputs.immediacy +
    w.duration * inputs.duration +
    w.institutionalImpact * inputs.institutionalImpact +
    w.personalRelevance * inputs.personalRelevance +
    w.confidence * inputs.confidence
  )
}

export interface BlindspotInputs {
  consequence: number
  localRelevance: number
  novelty: number
  localMediaCoverage: number
}

// A consequential local event with little/no local-media coverage. Floored at 0
// so a well-covered, low-consequence item never reads as a blindspot.
export function blindspotScore(inputs: BlindspotInputs): number {
  const w = SCORING_WEIGHTS.blindspot
  return Math.max(
    0,
    w.consequence * inputs.consequence +
      w.localRelevance * inputs.localRelevance +
      w.novelty * inputs.novelty -
      w.localMediaCoverage * inputs.localMediaCoverage
  )
}
