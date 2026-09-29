import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import { haversineMiles } from '../../geography'
import { parseCalFireIncidents, type CalFireRaw } from '../../adapters/calfire'

// CAL FIRE incidents as an ingestion source (§7). Reuses the live adapter's pure
// parser, then emits §5.1 shapes. Region-scoped (~40mi of Marin — fire relevance is
// wider than a tight place radius); fully-contained incidents are dropped. Maps to
// fire_incident (base_importance 60, min_geo 'place').
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_CENTER = { lat: 37.9735, lng: -122.5311 }
const REGION_RADIUS_MILES = 40

export function parseCalFireItems(
  body: unknown,
  opts: { center?: { lat: number; lng: number }; radiusMiles?: number } = {},
): NormalizedItem[] {
  const center = opts.center ?? MARIN_CENTER
  const radius = opts.radiusMiles ?? REGION_RADIUS_MILES
  const items: NormalizedItem[] = []

  for (const inc of parseCalFireIncidents((body as CalFireRaw[]) ?? [])) {
    if (inc.percentContained >= 100) continue // fully contained = not act-now
    if (haversineMiles(center.lat, center.lng, inc.lat, inc.lng) > radius) continue

    const updated = inc.updated || inc.started || undefined
    const acresText = inc.acres > 0 ? `${Math.round(inc.acres).toLocaleString()} ac` : null
    const headline = `${inc.name} — ${[acresText, `${Math.round(inc.percentContained)}% contained`].filter(Boolean).join(', ')}`

    items.push({
      externalId: inc.id,
      // containment/acres/update change over a fire's life — include them so an
      // updated incident is a new source_item that lands as an event update.
      contentHash: hashContent([inc.id, String(inc.acres), String(inc.percentContained), updated]),
      title: headline.length > 110 ? headline.slice(0, 108) + '…' : headline,
      url: inc.url || 'https://incidents.fire.ca.gov/',
      publishedAt: updated,
      placeText: inc.location || (inc.county ? `${inc.county} County` : undefined),
      geo: { lat: inc.lat, lng: inc.lng, precision: 'place' },
      extracted: {
        eventType: 'fire_incident',
        acres: inc.acres,
        percentContained: inc.percentContained,
        startedAt: inc.started || updated,
        summary: [inc.location, acresText].filter(Boolean).join(' · ') || undefined,
      },
    })
  }
  return items
}

export function calfireItemToCandidate(item: NormalizedItem): EventCandidate {
  const ex = item.extracted ?? {}
  return {
    eventType: 'fire_incident',
    dedupeKey: `calfire-incidents:${item.externalId ?? item.contentHash}`,
    headline: item.title,
    summary: ex.summary ? String(ex.summary) : undefined,
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { acres: ex.acres, percentContained: ex.percentContained },
  }
}

export const calfireIncidentsAdapter: SourceAdapter = {
  slug: 'calfire-incidents',
  resolvesByAbsence: true, // active incidents (?inactive=false): gone = contained/over
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const res = await fetch('https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`CAL FIRE HTTP ${res.status}`)
    return [{ body: await res.json(), contentType: 'application/json', url: 'https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List', fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseCalFireItems(raw.body)
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return [calfireItemToCandidate(item)]
  },
}
