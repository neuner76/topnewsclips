import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import {
  type MarinPermitRow, isSignificantPermit, plausibleValuation, permitDetailUrl,
  prettyPermitTitle, isExpiredPermit,
} from '../../adapters/marin-permits'

// Marin County building permits (Socrata mkbn-caye) as an ingestion source (§7).
// ALL non-expired, geocoded rows become source_items (the raw record), but only
// SIGNIFICANT permits (D13 filter — new/major/commercial/infrastructure, not routine
// reroof/MEP/solar) become development_update event candidates. Those land HELD
// (event_type.auto_publish=false): the "Change product" is reviewed, not
// auto-published (docs/local/CHANGES_MODEL.md). No proximity filter — ingestion is
// county-wide; proximity is per-user ranking, later (§9).
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const DATASET = 'mkbn-caye'
const FETCH_LIMIT = 200

export function parseMarinPermitItems(body: unknown): NormalizedItem[] {
  const rows = (body as MarinPermitRow[]) ?? []
  const items: NormalizedItem[] = []
  for (const r of rows) {
    if (isExpiredPermit(r)) continue // stale — not a current change
    const lat = r.latitude != null ? Number(r.latitude) : NaN
    const lng = r.longitude != null ? Number(r.longitude) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue // can't place it

    const value = plausibleValuation(r.construction_value)
    const effectiveDate = r.most_recent_issued_received_date ?? r.issued_date ?? r.received_date ?? undefined
    const desc = prettyPermitTitle((r.description ?? '').trim())
    const title = desc || `${(r.type_permit ?? 'Building')} permit`
    const externalId = r.unique_id ?? r.permit_number ?? `${lat},${lng}`

    items.push({
      externalId,
      contentHash: hashContent([externalId, r.description, r.construction_value, effectiveDate, r.permit_category]),
      title: title.length > 90 ? title.slice(0, 88) + '…' : title,
      url: permitDetailUrl(r.unique_id),
      publishedAt: effectiveDate,
      placeText: r.address ?? r.city_town ?? undefined,
      geo: { lat, lng, precision: 'address' },
      extracted: {
        significant: isSignificantPermit(r),
        valuationUsd: value > 0 ? value : undefined,
        address: r.address ?? undefined,
        city: r.city_town ?? undefined,
        zip: r.zipcode ?? undefined,
        startedAt: effectiveDate,
      },
    })
  }
  return items
}

// Only SIGNIFICANT permits become events; routine construction is recorded as a
// source_item but produces no candidate (returns []).
export function marinPermitToCandidates(item: NormalizedItem): EventCandidate[] {
  const ex = item.extracted ?? {}
  if (!ex.significant) return []
  const value = ex.valuationUsd ? Number(ex.valuationUsd) : undefined
  const summary = [ex.address, value ? `$${value.toLocaleString()}` : null].filter(Boolean).join(' · ') || undefined
  return [{
    eventType: 'development_update',
    dedupeKey: `marin-permits:${item.externalId ?? item.contentHash}`,
    headline: item.title,
    summary,
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { valuationUsd: value },
  }]
}

export const marinPermitsAdapter: SourceAdapter = {
  slug: 'marin-permits',
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const url = `https://data.marincounty.gov/resource/${DATASET}.json?$order=most_recent_issued_received_date%20DESC&$limit=${FETCH_LIMIT}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`marin-permits HTTP ${res.status}`)
    return [{ body: await res.json(), contentType: 'application/json', url, fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseMarinPermitItems(raw.body)
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return marinPermitToCandidates(item)
  },
}
