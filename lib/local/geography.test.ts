import { describe, expect, it } from 'vitest'
import { haversineMiles, scoreLocalRelevance } from './geography'
import { SCORING_WEIGHTS } from './scoring.config'
import type { LocalEvent, SavedPlace, GeoScope } from './types'

const place: SavedPlace = {
  id: 'home', label: 'Near Me', type: 'home',
  latitude: 38.1, longitude: -122.57, radiusMiles: 5,
  city: 'Novato', county: 'Marin County', state: 'CA', isPrivate: true,
}

function ev(geo: GeoScope): LocalEvent {
  return {
    id: 'e', title: 't', eventType: 'other', status: 'new',
    firstSeenAt: '2026-09-07T00:00:00Z', latestUpdateAt: '2026-09-07T00:00:00Z',
    geo, consequenceScore: 0, confidence: 'medium', sources: [],
  }
}

describe('haversineMiles', () => {
  it('is 0 for the same point', () => {
    expect(haversineMiles(38.1, -122.57, 38.1, -122.57)).toBeCloseTo(0, 5)
  })
  it('is ~69 miles for one degree of latitude', () => {
    expect(haversineMiles(38, -122, 39, -122)).toBeCloseTo(69.1, 0)
  })
})

describe('scoreLocalRelevance', () => {
  it('is ~1 for an event at the saved place matching city + county', () => {
    const r = scoreLocalRelevance(ev({ latitude: 38.1, longitude: -122.57, cities: ['Novato'], counties: ['Marin County'] }), place)
    expect(r).toBeCloseTo(1, 5)
  })

  it('is 0 for a far event with no city/county match', () => {
    const r = scoreLocalRelevance(ev({ latitude: 40.0, longitude: -120.0, cities: ['Reno'], counties: ['Washoe County'] }), place)
    expect(r).toBeCloseTo(0, 5)
  })

  it('scores a city match even with no coordinates (from config weight)', () => {
    const r = scoreLocalRelevance(ev({ cities: ['Novato'] }), place)
    expect(r).toBeCloseTo(SCORING_WEIGHTS.localRelevance.cityMatch, 5)
  })

  it('ranks a nearby event above a distant one', () => {
    const near = scoreLocalRelevance(ev({ latitude: 38.11, longitude: -122.58 }), place)
    const far = scoreLocalRelevance(ev({ latitude: 38.5, longitude: -122.9 }), place)
    expect(near).toBeGreaterThan(far)
  })

  it('matches city case-insensitively', () => {
    expect(scoreLocalRelevance(ev({ cities: ['novato'] }), place)).toBeCloseTo(SCORING_WEIGHTS.localRelevance.cityMatch, 5)
  })
})
