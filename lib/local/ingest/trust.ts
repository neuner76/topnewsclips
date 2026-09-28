// Trust model (§4). Pure functions — the single source of truth for evidence
// levels, verification status and confidence. Never build a parallel system (§4.1).
import type { GeoPrecision } from './types'

export const LOCAL_JOURNALISM_MAX_TIER = 6 // Tier 1–6 journalism earns the "Reported" label

export type VerificationStatus = 'confirmed' | 'developing' | 'community_reports' | 'unverified'

// §4.1 — evidence_level from source_type + credibility_tier (+ override).
export function deriveEvidenceLevel(source: {
  sourceType: string
  credibilityTier?: number | null
  trusted?: boolean
  evidenceLevelOverride?: number | null
}): number {
  if (source.evidenceLevelOverride != null) return source.evidenceLevelOverride
  if (['official_agency', 'utility', 'public_dataset', 'sensor'].includes(source.sourceType)) return 1
  if (source.sourceType === 'journalism') {
    return source.credibilityTier != null && source.credibilityTier <= LOCAL_JOURNALISM_MAX_TIER ? 2 : 5
  }
  if ((source.sourceType === 'community_org' || source.sourceType === 'social_account') && source.trusted) return 3
  return 5 // any other social_account / user_submission
}

// §4.3 — verification status from the evidence levels of the attached INDEPENDENT
// items (dependent/duplicate items are filtered out by the caller, §4.2).
// Rules evaluated in order. Level 4 is an event-level outcome, never an item level (D9).
export function deriveVerificationStatus(independentLevels: number[]): VerificationStatus {
  if (independentLevels.some(l => l === 1)) return 'confirmed'
  const l2 = independentLevels.filter(l => l === 2).length
  const l3 = independentLevels.filter(l => l === 3).length
  if (l2 >= 2 || (l2 >= 1 && l3 >= 1)) return 'confirmed'
  if (l2 === 1) return 'developing'
  const l35 = independentLevels.filter(l => l === 3 || l === 5).length
  if (l35 >= 3) return 'community_reports'
  return 'unverified'
}

// §4.4 — internal confidence for ranking (readers see only the status label).
const LEVEL_BASE: Record<number, number> = { 1: 0.95, 2: 0.85, 3: 0.7, 5: 0.35 }
const GEO_FACTOR: Record<GeoPrecision, number> = {
  exact: 1, address: 1, block: 1, segment: 1, place: 0.9, city: 0.8, county: 0.6, unknown: 0.6,
}

export function computeConfidence(independentLevels: number[], geoPrecision: GeoPrecision): number {
  if (independentLevels.length === 0) return 0
  const base = Math.max(...independentLevels.map(l => LEVEL_BASE[l] ?? 0.35))
  const withCorroboration = Math.min(base + 0.05 * (independentLevels.length - 1), 0.99)
  return withCorroboration * (GEO_FACTOR[geoPrecision] ?? 0.6)
}
