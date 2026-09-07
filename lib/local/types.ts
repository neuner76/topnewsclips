// TopNewsClips Local — canonical types (Build A).
//
// LocalEvent is a SIBLING of the national `Story` (lib/types.ts), never a
// subclass; `storyClusterId` bridges to an existing national/regional cluster
// when one exists. All scoring inputs are floats in [0, 1] (see lib/local/scoring).

// Minimal GeoJSON polygon shapes (no @types/geojson dependency). A Polygon is an
// array of linear rings ([lng, lat] positions); a MultiPolygon is an array of
// those. Only what the geography layer needs.
export type GeoPosition = [number, number] // [longitude, latitude]
export interface GeoPolygon {
  type: 'Polygon'
  coordinates: GeoPosition[][]
}
export interface GeoMultiPolygon {
  type: 'MultiPolygon'
  coordinates: GeoPosition[][][]
}

export type Confidence = 'high' | 'medium' | 'low'

export interface SavedPlace {
  id: string
  label: string
  type: 'home' | 'work' | 'school' | 'property' | 'route' | 'custom'
  latitude: number
  longitude: number
  radiusMiles?: number
  zipCode?: string
  city?: string
  county?: string
  state?: string
  isPrivate: boolean
}

export interface GeoScope {
  latitude?: number
  longitude?: number
  placeName?: string
  zipCodes?: string[]
  cities?: string[]
  counties?: string[]
  regions?: string[]
  state?: string
  affectedPolygon?: GeoPolygon | GeoMultiPolygon
  impactRadiusMiles?: number
}

export type LocalEventType =
  | 'emergency'
  | 'fire'
  | 'crime_public_safety'
  | 'road_closure'
  | 'traffic'
  | 'weather'
  | 'air_quality'
  | 'earthquake'
  | 'flood'
  | 'planning'
  | 'building_permit'
  | 'government_meeting'
  | 'government_vote'
  | 'contract'
  | 'utility'
  | 'school'
  | 'environment'
  | 'business_opening'
  | 'business_closure'
  | 'local_news'
  | 'physical_change'
  | 'other'

export type LocalEventStatus = 'new' | 'developing' | 'ongoing' | 'resolved'

export type LocalEvidenceType =
  | 'official_alert'
  | 'public_record'
  | 'local_news'
  | 'sensor'
  | 'camera'
  | 'satellite'
  | 'community_submission'

// One piece of provenance behind a LocalEvent. `status` distinguishes confirmed
// vs observed vs inferred vs pending (the "HOW WE KNOW" panel); never imply a
// sensor/community source proves cause or motive.
export interface LocalEvidenceSource {
  type: LocalEvidenceType
  label: string
  url?: string
  observedAt: string // ISO timestamp
  confidence?: Confidence
  status?: 'confirmed' | 'observed' | 'inferred' | 'pending'
}

export interface LocalEvent {
  id: string
  title: string
  eventType: LocalEventType
  status: LocalEventStatus // transitions per Decisions › Event lifecycle
  storyClusterId?: string // bridge to an existing national cluster, nullable
  firstSeenAt: string
  latestUpdateAt: string
  geo: GeoScope
  consequenceScore: number
  relevanceScore?: number
  confidence: Confidence
  sources: LocalEvidenceSource[]
  summary?: string
  whyItMatters?: string
  whatChanged?: string
  openQuestions?: string[]
}
