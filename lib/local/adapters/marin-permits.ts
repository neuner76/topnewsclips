// Marin County building permits (Build B) via the Socrata open-data portal
// (dataset mkbn-caye) — the reliable path, since the Legistar public API is not
// enabled for Marin. Rows are already geocoded (lat/lng, APN, valuation). Feeds
// the "Changing Around You" section with real permit activity.
import type { LocalEvent } from '../types'
import { haversineMiles } from '../geography'
import { nearAnyAnchor, type Anchor } from '../anchors'

const DATASET = 'mkbn-caye'
// Canonical human dataset page (the /d/ short URL 302s here). The Socrata data
// explorer accepts a SoQL filter deep-link, so we can link a card straight to
// that one permit's record instead of the whole dataset.
const DATASET_HUMAN_URL = `https://data.marincounty.gov/County-Government/Building-Permit/${DATASET}`

// Where a permit card links. Marin has no public per-permit page, and the
// open-data "explore" SPA ignores a URL filter (it just opened the whole
// dataset), so we render our own detail view at /local/permit/[id] keyed on
// unique_id (the only id present on EVERY row). Falls back to the dataset page
// when a row somehow lacks a unique_id.
export function permitDetailUrl(uniqueId?: string | null): string {
  const id = (uniqueId ?? '').trim()
  if (!id) return DATASET_HUMAN_URL
  return `/local/permit/${encodeURIComponent(id)}`
}

// The county open-data dataset page — used as the "view the public record"
// provenance link on our detail page.
export const MARIN_PERMITS_DATASET_URL = DATASET_HUMAN_URL

// Marin's public "Building Permits Report" — a full-text-searchable grid of the
// county's permits (the one with the real county permit numbers). The county
// blocks per-permit deep links, so we send users here to search by the parcel
// number (APN), which they copy from our detail page. Verified: a full-text
// search on the APN returns that parcel's permits.
export const MARIN_PERMIT_LOOKUP_URL =
  'https://data.marincounty.gov/County-Government/Building-Permits-Report/nits-hbvx'

// Link to the ONE permit's authoritative record on the county open-data API
// (filtered by unique_id). The open-data "explore" SPA ignores a URL filter, so
// this API view is the reliable single-record link. Falls back to the dataset.
export function permitOpenDataRecordUrl(uniqueId?: string | null): string {
  const id = (uniqueId ?? '').trim()
  if (!id) return DATASET_HUMAN_URL
  return `https://data.marincounty.gov/resource/${DATASET}.json?unique_id=${encodeURIComponent(id)}`
}

// Pure: raw row -> the fields we render on the permit detail page.
export function permitDetailFields(r: MarinPermitRow): PermitDetail {
  const desc = prettyPermitTitle((r.description ?? '').trim())
  const value = Number(r.construction_value ?? 0) || 0
  const date = r.most_recent_issued_received_date ?? r.issued_date ?? r.received_date ?? undefined
  const lat = r.latitude != null ? Number(r.latitude) : NaN
  const lng = r.longitude != null ? Number(r.longitude) : NaN
  return {
    uniqueId: r.unique_id ?? '',
    // Only the REAL permit number (present on simple permits). The tracking id is
    // an internal ref, not the county's public permit number, so never show it.
    permitNumber: r.permit_number || undefined,
    title: desc || `${titleCase(r.type_permit ?? 'Building')} permit`,
    description: desc || undefined,
    address: r.address ? cleanAddress(r.address) : undefined,
    valuationUsd: value > 0 ? value : undefined,
    type: r.type_permit ? titleCase(r.type_permit) : undefined,
    category: r.permit_category || undefined,
    workClass: r.permit_work_class ? titleCase(r.permit_work_class) : undefined,
    parcelNumber: r.parcel_number || undefined,
    contractorAddress: r.contractor_address ? cleanAddress(r.contractor_address) : undefined,
    dateLabel: date ? date.slice(0, 10) : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  }
}

// Fetch one permit's record by unique_id from the county open-data API. Returns
// null when not found. This is the authoritative public record for the permit.
export async function fetchMarinPermitDetail(uniqueId: string): Promise<PermitDetail | null> {
  const url = `https://data.marincounty.gov/resource/${DATASET}.json?unique_id=${encodeURIComponent(uniqueId)}&$limit=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`Marin permit detail HTTP ${res.status}`)
  const rows = (await res.json()) as MarinPermitRow[]
  return rows.length > 0 ? permitDetailFields(rows[0]) : null
}

export interface MarinPermitRow {
  address?: string
  city_town?: string
  zipcode?: string
  parcel_number?: string
  construction_value?: string
  description?: string
  type_permit?: string
  permit_category?: string
  permit_work_class?: string
  permit_number?: string
  permit_tracking_id?: string
  contractor_address?: string
  received_date?: string | null
  issued_date?: string | null
  most_recent_issued_received_date?: string | null
  latitude?: string
  longitude?: string
  unique_id?: string
}

// Display shape for a single permit's detail page — everything we surface at
// /local/permit/[id], derived purely from a raw row (unit-testable).
export interface PermitDetail {
  uniqueId: string
  permitNumber?: string
  title: string
  description?: string
  address?: string
  valuationUsd?: number
  type?: string
  category?: string
  workClass?: string
  parcelNumber?: string
  contractorAddress?: string
  dateLabel?: string // YYYY-MM-DD (issued or received)
  lat?: number
  lng?: number
}

// Valuation -> [0, 1] consequence, log-scaled: $1 -> 0, $1M -> 1.0.
export function permitConsequence(valuation: number): number {
  if (!(valuation > 0)) return 0
  return Math.min(Math.log10(valuation) / 6, 1)
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Addresses come UPPERCASE from the county. Title-case them, but keep the
// trailing 2-letter state code and ZIP intact ("...Sausalito, CA 94965", not
// "...Sausalito, Ca 94965").
function cleanAddress(s: string): string {
  return titleCase(s)
    .replace(/,\s*Ca\s+(\d{5})/i, ', CA $1')
    .replace(/\s+/g, ' ')
    .trim()
}

// Expand the most common permit-clerk shorthand so titles read like English
// instead of a database dump. Whole-word, case-insensitive; order matters.
const PERMIT_ABBREV: Array<[RegExp, string]> = [
  [/\bRplc\b/gi, 'Replace'],
  [/\bRepl\b/gi, 'Replace'],
  [/\bRmdl\b/gi, 'Remodel'],
  [/\bReRoof\b/gi, 'Re-roof'],
  [/\bIns\b/gi, 'Install'],
  [/\bInstl\b/gi, 'Install'],
  [/\bRepr\b/gi, 'Repair'],
  [/\bAddn\b/gi, 'Addition'],
  [/\bBldg\b/gi, 'Building'],
  [/\bComm'?l\b/gi, 'Commercial'],
  [/\bResid\b/gi, 'Residential'],
  [/\bW\//gi, 'with '],
  [/\(E\)/gi, 'existing'],
  [/\bSfd\b/gi, 'SFD'],
]

// Permits whose description is flagged expired are stale — they did not just
// "change around you". The county marks these with a "***Expired" suffix.
function isExpiredPermit(r: MarinPermitRow): boolean {
  return /\*\*\*\s*expired/i.test(`${r.description ?? ''} ${r.type_permit ?? ''}`)
}

function prettyPermitTitle(desc: string): string {
  let s = desc.replace(/\*{2,}\s*expired\s*\*{0,}/gi, '').replace(/\*{2,}/g, '').trim()
  for (const [re, rep] of PERMIT_ABBREV) s = s.replace(re, rep)
  return s.replace(/\s+/g, ' ').trim()
}

export function normalizeMarinPermits(
  rows: MarinPermitRow[],
  opts: { limit?: number; sort?: 'consequence' | 'recency'; near?: { lat: number; lng: number }; radiusMiles?: number; anchors?: Anchor[] } = {},
): LocalEvent[] {
  const events: LocalEvent[] = []
  for (const r of rows) {
    if (isExpiredPermit(r)) continue // stale — not a current change

    const lat = r.latitude != null ? Number(r.latitude) : NaN
    const lng = r.longitude != null ? Number(r.longitude) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue // can't place it

    // Proximity gate: keep only permits near the reader so "Changing Around You"
    // is genuinely local, not county-wide. Multi-place (anchors) takes precedence
    // over a single near-point; distance shown is to the nearest anchor/point.
    let distanceMiles: number | undefined
    if (opts.anchors && opts.anchors.length > 0) {
      const m = nearAnyAnchor(lat, lng, opts.anchors)
      if (!m.ok) continue
      distanceMiles = m.miles
    } else if (opts.near) {
      distanceMiles = haversineMiles(opts.near.lat, opts.near.lng, lat, lng)
      if (opts.radiusMiles != null && distanceMiles > opts.radiusMiles) continue
    }

    const value = Number(r.construction_value ?? 0) || 0
    // The dataset's `received_date`/`issued_date` columns are empty; the only
    // populated date is `most_recent_issued_received_date`. Use it as THE date.
    const effectiveDate = r.most_recent_issued_received_date ?? r.issued_date ?? r.received_date ?? undefined
    const updated = effectiveDate ?? new Date().toISOString()
    const desc = prettyPermitTitle((r.description ?? '').trim())
    const title = desc || `${titleCase(r.type_permit ?? 'Building')} permit`

    // Valuation is rendered as the amount badge (amountUsd), so keep it out of the text.
    const changedParts = [
      'Permit issued',
      r.address ? cleanAddress(r.address) : null,
      distanceMiles != null ? `~${distanceMiles < 1 ? '<1' : Math.round(distanceMiles)} mi away` : null,
    ].filter(Boolean)

    events.push({
      id: `marin-permit-${r.unique_id ?? r.permit_number ?? `${lat},${lng}`}`,
      title: title.length > 90 ? title.slice(0, 88) + '…' : title,
      eventType: 'building_permit',
      status: 'new',
      firstSeenAt: updated,
      latestUpdateAt: updated,
      geo: {
        latitude: lat, longitude: lng,
        cities: r.city_town ? [r.city_town] : undefined,
        zipCodes: r.zipcode ? [r.zipcode] : undefined,
        counties: ['Marin County'],
      },
      consequenceScore: permitConsequence(value),
      confidence: 'high',
      amountUsd: value > 0 ? value : undefined,
      sources: [{ type: 'public_record', label: 'Marin County permits', url: permitDetailUrl(r.unique_id), observedAt: updated, status: 'confirmed' }],
      whatChanged: changedParts.join(' · '),
    })
  }
  // 'recency' preserves the input order (rows arrive newest-first); otherwise
  // rank by consequence (valuation).
  if (opts.sort !== 'recency') events.sort((a, b) => b.consequenceScore - a.consequenceScore)
  return opts.limit != null ? events.slice(0, opts.limit) : events
}

// Live fetch: most-recent permits, then normalize (which ranks by valuation).
// Pass `near`/`radiusMiles` to keep only permits within range of the reader.
// NOTE: this dataset's `received_date`/`issued_date` columns are EMPTY — the only
// populated date is `most_recent_issued_received_date`, so we MUST order by it.
// Ordering by an empty column silently returns an arbitrary (mostly ancient) page.
// Fetch a wide recent pool (500) so sparse areas (West Marin) still fill after the
// near-anchor filter, then normalize ranks by valuation.
export async function fetchMarinPermits(
  limit = 6,
  sort: 'consequence' | 'recency' = 'consequence',
  opts: { near?: { lat: number; lng: number }; radiusMiles?: number; anchors?: Anchor[] } = {},
): Promise<LocalEvent[]> {
  const url = `https://data.marincounty.gov/resource/${DATASET}.json?$order=most_recent_issued_received_date%20DESC&$limit=500`
  const res = await fetch(url, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`Marin permits HTTP ${res.status}`)
  return normalizeMarinPermits(await res.json(), { limit, sort, near: opts.near, radiusMiles: opts.radiusMiles, anchors: opts.anchors })
}
