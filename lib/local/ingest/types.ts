// My Local — ingestion contract (spec §5.1). The typed interface every source
// adapter implements. One adapter per source in lib/local/ingest/adapters/<slug>.ts;
// the §7 wrap adapters reuse their existing fetch/parse logic behind this shape
// (D7). The pipeline (§5.2) drives adapters: FETCH → ARCHIVE → NORMALIZE → DEDUPE
// → GEOLOCATE → OBSERVATIONS → CHANGE DETECTION → EVENT → VERIFY → SCORE → PUBLISH.

// Geo precision — mirrors local_source_item.geo_precision (§3.2).
export type GeoPrecision =
  | 'exact' | 'address' | 'block' | 'segment' | 'place' | 'city' | 'county' | 'unknown'

export type EventSourceRole = 'origin' | 'corroboration' | 'update' | 'resolution'
export type ProcessingState = 'new' | 'processed' | 'ignored' | 'error'

// A [lng, lat] point, or GeoJSON geometry, as the adapter knows it.
export interface GeoRef {
  lng: number
  lat: number
  geojson?: unknown // optional full geometry (line/polygon) when available
  precision: GeoPrecision
}

export interface FetchContext {
  now: Date
  since?: Date // for incremental sources; the last successful fetch time
}

// Raw, un-normalized payload straight off the network (archived per §5.3).
export interface RawPayload {
  body: unknown // parsed JSON, or a string for HTML/XML/CSV
  contentType?: string
  url?: string
  fetchedAt: string // ISO
}

// Normalized record → the local_source_item shape (§3.2).
export interface NormalizedItem {
  externalId?: string
  contentHash: string // hash of the normalized payload (dedupe key, §5.2)
  title?: string
  bodyText?: string
  url?: string
  publishedAt?: string // ISO
  placeText?: string // raw location string as given
  geo?: GeoRef
  extracted?: Record<string, unknown> // structured fields for downstream stages
}

// A reading/state change on an entity → local_observation (§3.5). Dataset/sensor
// sources emit these; change detection (§7.1) turns them into events.
export interface ObservationInput {
  entityKey: string // stable key the pipeline resolves to a local_entity
  metric: string // storage_pct | customers_out | aqi | water_level_ft | discharge_cfs | status
  valueNum?: number
  valueText?: string
  unit?: string
  observedAt: string // ISO
}

// A candidate event from an incident/alert source → matched/created as a
// local_events row with an attached local_event_source (§7.2/§7.3).
export interface EventCandidate {
  eventType: string // → local_event_type.slug
  dedupeKey?: string // deterministic key for single-source structured feeds (§7.3)
  headline?: string
  summary?: string
  startedAt?: string // ISO
  geo?: GeoRef
  sourceRole?: EventSourceRole // defaults to 'origin'
  fields?: Record<string, unknown> // structured fields for templates/importance (§7.5/§9)
}

// One adapter per source (§5.1). `fetch` is network-only; `normalize` produces
// source_item rows; dataset sources add `toObservations`, incident/alert sources
// add `toEventCandidates`.
export interface SourceAdapter {
  slug: string
  fetch(ctx: FetchContext): Promise<RawPayload[]>
  normalize(raw: RawPayload): Promise<NormalizedItem[]>
  toObservations?(item: NormalizedItem): ObservationInput[]
  toEventCandidates?(item: NormalizedItem): EventCandidate[]
}
