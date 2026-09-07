// Fixture LocalEvents for the sections that are not live in Build A (everything
// except Your Environment). Each renders with a visible "fixture" badge until its
// adapter ships (Builds B/C). Drawn from the spec's module examples.
import type { LocalEvent } from './types'

const iso = '2026-09-07T12:00:00Z'

function ev(partial: Partial<LocalEvent> & Pick<LocalEvent, 'id' | 'title' | 'eventType'>): LocalEvent {
  return {
    status: 'new', firstSeenAt: iso, latestUpdateAt: iso,
    geo: {}, consequenceScore: 0, confidence: 'medium', sources: [],
    ...partial,
  }
}

export const FIXTURE_NEED_TO_KNOW: LocalEvent[] = [
  ev({
    id: 'fx-ntk-fire', title: 'Vegetation fire reported near Indian Valley', eventType: 'fire',
    status: 'developing', confidence: 'high', consequenceScore: 0.82,
    geo: { latitude: 38.06, longitude: -122.55, cities: ['Novato'], counties: ['Marin County'] },
    summary: 'Marin County Fire is responding to a vegetation fire; no structures threatened as of the latest update.',
    whyItMatters: 'Active fire within a few miles of saved places during elevated fire weather.',
    sources: [{ type: 'official_alert', label: 'Marin County Fire', observedAt: iso, status: 'confirmed', confidence: 'high' }],
  }),
]

export const FIXTURE_CHANGING_AROUND_YOU: LocalEvent[] = [
  ev({
    id: 'fx-permit', title: '26-unit residential project — planning application submitted', eventType: 'planning',
    consequenceScore: 0.55,
    geo: { latitude: 38.11, longitude: -122.58, cities: ['Novato'], counties: ['Marin County'] },
    whatChanged: 'New planning application submitted.',
    sources: [{ type: 'public_record', label: 'Marin County planning', observedAt: iso, status: 'confirmed' }],
  }),
]

export const FIXTURE_YOUR_GOVERNMENT: LocalEvent[] = [
  ev({
    id: 'fx-gov', title: 'Council votes Tuesday on downtown redevelopment', eventType: 'government_vote',
    consequenceScore: 0.6,
    geo: { cities: ['Novato'], counties: ['Marin County'] },
    whyItMatters: 'A major land-use decision affecting downtown; staff recommends approval.',
    sources: [{ type: 'public_record', label: 'Novato City Council agenda', observedAt: iso, status: 'confirmed' }],
  }),
]

export const FIXTURE_ROADS_AND_INCIDENTS: LocalEvent[] = [
  ev({
    id: 'fx-road', title: 'US-101 southbound crash near San Marin', eventType: 'traffic',
    consequenceScore: 0.4,
    geo: { latitude: 38.11, longitude: -122.57, counties: ['Marin County'] },
    whatChanged: 'Estimated delay: +17 min.',
    sources: [{ type: 'official_alert', label: 'CHP', observedAt: iso, status: 'observed', confidence: 'medium' }],
  }),
]

export const FIXTURE_LOCAL_REPORTING: LocalEvent[] = [
  ev({
    id: 'fx-news', title: 'Point Reyes Light investigates West Marin groundwater', eventType: 'local_news',
    consequenceScore: 0.5,
    geo: { counties: ['Marin County'], placeName: 'West Marin' },
    sources: [{ type: 'local_news', label: 'Point Reyes Light', observedAt: iso, status: 'confirmed' }],
  }),
]

export const FIXTURE_LOCAL_BLINDSPOT: LocalEvent[] = [
  ev({
    id: 'fx-blindspot', title: 'County considering $12.4M services contract', eventType: 'contract',
    consequenceScore: 0.7,
    geo: { counties: ['Marin County'] },
    whyItMatters: 'A major county expenditure with no tracked local-media coverage; board vote Tuesday.',
    sources: [{ type: 'public_record', label: 'Marin County agenda', observedAt: iso, status: 'confirmed' }],
  }),
]
