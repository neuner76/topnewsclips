// TopNewsClips Local — analytics event names + privacy-safe property builder.
//
// Pure (no client import) so it's unit-testable; a client component calls the
// shared track() with these props. NEVER include exact coordinates — properties
// carry distance/relevance BANDS only (see the coordinate-leak test).
import type { LocalEvent } from './types'
import { distanceBand, type DistanceBand } from './privacy'

export const LOCAL_ANALYTICS_EVENTS = {
  digestViewed: 'local_digest_viewed',
  eventClicked: 'local_event_clicked',
  blindspotClicked: 'local_blindspot_clicked',
  governmentDocClicked: 'local_government_document_clicked',
  cameraOpened: 'local_camera_opened',
  placeChanged: 'local_place_changed',
  followMoneyOpened: 'local_follow_money_opened',
} as const

export type RelevanceBand = 'high' | 'medium' | 'low'

export function relevanceBand(score: number): RelevanceBand {
  if (score >= 0.66) return 'high'
  if (score >= 0.33) return 'medium'
  return 'low'
}

export interface LocalEventAnalyticsProps {
  section: string
  eventType: string
  relevanceBand?: RelevanceBand
  distanceBand?: DistanceBand
  confidence?: string
  sourceType?: string
}

export function localEventProps(
  event: LocalEvent,
  section: string,
  opts: { distanceMiles?: number } = {}
): LocalEventAnalyticsProps {
  return {
    section,
    eventType: event.eventType,
    relevanceBand: event.relevanceScore != null ? relevanceBand(event.relevanceScore) : undefined,
    distanceBand: opts.distanceMiles != null ? distanceBand(opts.distanceMiles) : undefined,
    confidence: event.confidence,
    sourceType: event.sources[0]?.type,
  }
}
