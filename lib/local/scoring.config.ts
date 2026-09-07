// TopNewsClips Local — scoring weights (single source of truth).
//
// All scoring inputs are floats in [0, 1]; formulas are weighted sums. Weights
// live here so they are tunable in one place and tests can assert scoring reads
// from config rather than hardcoding (Phase 17). Defaults per Decisions › Scoring.

export const SCORING_WEIGHTS = {
  // localConsequence weights sum to 1.0.
  localConsequence: {
    severity: 0.25,
    peopleAffected: 0.15,
    proximity: 0.2,
    immediacy: 0.15,
    duration: 0.05,
    institutionalImpact: 0.1,
    personalRelevance: 0.05,
    confidence: 0.05,
  },
  // blindspotScore = 0.4·consequence + 0.3·localRelevance + 0.2·novelty
  //                  − 0.5·localMediaCoverage, floored at 0.
  blindspot: {
    consequence: 0.4,
    localRelevance: 0.3,
    novelty: 0.2,
    localMediaCoverage: 0.5, // subtracted
  },
  // localRelevance weights sum to 1.0.
  localRelevance: {
    proximity: 0.6,
    cityMatch: 0.25,
    countyMatch: 0.15,
  },
} as const

// Confidence label → normalized number (Decisions › Scoring).
export const CONFIDENCE_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
}
