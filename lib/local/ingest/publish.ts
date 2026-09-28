// Publishing rules (§10). Pure decision: does an event auto-publish, or is it held
// (with a reason)? public_safety and community_report are never auto-published.
import type { GeoPrecision } from './types'

// Lower rank = more precise. An event's precision must be ≤ the type's min.
const GEO_RANK: Record<GeoPrecision, number> = {
  exact: 0, address: 1, block: 2, segment: 3, place: 4, city: 5, county: 6, unknown: 7,
}
const NEVER_AUTO_PUBLISH = new Set(['public_safety', 'community_report'])

export interface PublishInput {
  eventType: string
  autoPublish: boolean // event_type.auto_publish
  autoPublishMinEvidenceLevel?: number | null
  minGeoPrecision?: GeoPrecision | null
  geoPrecision?: GeoPrecision | null
  attachedEvidenceLevels: number[]
  hasRequiredFields: boolean
  textValid: boolean // headline/summary passed validation (§7.5)
}

export interface PublishDecision {
  state: 'published' | 'held'
  reason: string
}

export function decidePublish(i: PublishInput): PublishDecision {
  if (NEVER_AUTO_PUBLISH.has(i.eventType)) return { state: 'held', reason: 'never auto-published' }
  if (!i.autoPublish) return { state: 'held', reason: 'event_type.auto_publish=false' }

  const minLevel = i.autoPublishMinEvidenceLevel ?? 1
  if (!i.attachedEvidenceLevels.some(l => l <= minLevel)) {
    return { state: 'held', reason: `no attached item at evidence_level<=${minLevel}` }
  }

  if (i.minGeoPrecision) {
    const need = GEO_RANK[i.minGeoPrecision] ?? 7
    const have = GEO_RANK[i.geoPrecision ?? 'unknown'] ?? 7
    if (have > need) return { state: 'held', reason: `geo_precision "${i.geoPrecision}" coarser than "${i.minGeoPrecision}"` }
  }

  if (!i.hasRequiredFields) return { state: 'held', reason: 'missing required fields' }
  if (!i.textValid) return { state: 'held', reason: 'headline/summary failed validation' }

  return { state: 'published', reason: 'auto-published (all checks passed)' }
}
