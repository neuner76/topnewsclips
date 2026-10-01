import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import { haversineMiles, mapLink } from '../../geography'
import { parseFirmsCsv, isConfident } from '../../adapters/firms'

// NASA FIRMS active-fire / thermal-anomaly detections as a §7 ingestion source.
// Reuses the live adapter's CSV parser, then clusters confident detections into a
// grid cell → one fire_detection event per cell (distinct from CAL FIRE's confirmed
// fire_incident: a satellite hotspot is a heat signature, not a confirmed blaze —
// lower base_importance). FIRMS is a rolling 24h window, so resolvesByAbsence clears
// a cell once it stops reporting. Needs NASA_FIRMS_MAP_KEY (no key → no ingest).
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_CENTER = { lat: 37.9735, lng: -122.5311 }
const REGION_RADIUS_MILES = 30
const GRID_DEG = 0.02 // ~1.4 mi cells — collapses adjacent pixels of one fire

interface Cell { lat: number; lng: number; count: number; acqDate: string }

export function parseFirmsItems(
  csv: string,
  opts: { center?: { lat: number; lng: number }; radiusMiles?: number } = {},
): NormalizedItem[] {
  const center = opts.center ?? MARIN_CENTER
  const radius = opts.radiusMiles ?? REGION_RADIUS_MILES
  const cells = new Map<string, Cell>()

  for (const d of parseFirmsCsv(csv)) {
    if (!isConfident(d.confidence)) continue
    if (haversineMiles(center.lat, center.lng, d.lat, d.lng) > radius) continue
    const key = `${(Math.round(d.lat / GRID_DEG) * GRID_DEG).toFixed(3)},${(Math.round(d.lng / GRID_DEG) * GRID_DEG).toFixed(3)}`
    const existing = cells.get(key)
    if (existing) {
      existing.count += 1
      if (d.acqDate > existing.acqDate) existing.acqDate = d.acqDate
    } else {
      cells.set(key, { lat: d.lat, lng: d.lng, count: 1, acqDate: d.acqDate }) // first pixel = representative point
    }
  }

  const items: NormalizedItem[] = []
  for (const [key, c] of cells) {
    const headline = c.count === 1 ? 'Satellite fire detection' : `${c.count} satellite fire detections`
    items.push({
      externalId: key,
      contentHash: hashContent([key, String(c.count), c.acqDate]),
      title: headline,
      url: mapLink(c.lat, c.lng), // FIRMS map has no per-detection page → pin the exact spot
      publishedAt: c.acqDate ? `${c.acqDate}T00:00:00Z` : undefined,
      geo: { lat: c.lat, lng: c.lng, precision: 'place' },
      extracted: {
        count: c.count,
        startedAt: c.acqDate ? `${c.acqDate}T00:00:00Z` : undefined,
        summary: `${c.count} heat ${c.count === 1 ? 'signature' : 'signatures'} detected by satellite (VIIRS) in the last 24h`,
        cellKey: key,
      },
    })
  }
  return items
}

export function firmsItemToCandidate(item: NormalizedItem): EventCandidate {
  const ex = item.extracted ?? {}
  return {
    eventType: 'fire_detection',
    dedupeKey: `nasa-firms:${ex.cellKey ?? item.externalId ?? item.contentHash}`,
    headline: item.title,
    summary: ex.summary ? String(ex.summary) : undefined,
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { count: ex.count },
  }
}

export const nasaFirmsAdapter: SourceAdapter = {
  slug: 'nasa-firms',
  resolvesByAbsence: true, // rolling 24h window: a cell that stops reporting is cleared
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const key = process.env.NASA_FIRMS_MAP_KEY
    if (!key) return [] // no key → nothing to ingest (source stays healthy)
    const radius = REGION_RADIUS_MILES
    const dLat = radius / 69
    const dLng = radius / (69 * Math.cos((MARIN_CENTER.lat * Math.PI) / 180))
    const bbox = `${MARIN_CENTER.lng - dLng},${MARIN_CENTER.lat - dLat},${MARIN_CENTER.lng + dLng},${MARIN_CENTER.lat + dLat}`
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${bbox}/1`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`)
    return [{ body: await res.text(), contentType: 'text/csv', url, fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseFirmsItems(String(raw.body))
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return [firmsItemToCandidate(item)]
  },
}
