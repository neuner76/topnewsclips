// Marin County building permits (Build B) via the Socrata open-data portal
// (dataset mkbn-caye) — the reliable path, since the Legistar public API is not
// enabled for Marin. Rows are already geocoded (lat/lng, APN, valuation). Feeds
// the "Changing Around You" section with real permit activity.
import type { LocalEvent } from '../types'

const DATASET = 'mkbn-caye'
const DATASET_URL = `https://data.marincounty.gov/d/${DATASET}`

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
  received_date?: string | null
  issued_date?: string | null
  most_recent_issued_received_date?: string | null
  latitude?: string
  longitude?: string
  unique_id?: string
}

// Valuation -> [0, 1] consequence, log-scaled: $1 -> 0, $1M -> 1.0.
export function permitConsequence(valuation: number): number {
  if (!(valuation > 0)) return 0
  return Math.min(Math.log10(valuation) / 6, 1)
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function normalizeMarinPermits(rows: MarinPermitRow[], opts: { limit?: number; sort?: 'consequence' | 'recency' } = {}): LocalEvent[] {
  const events: LocalEvent[] = []
  for (const r of rows) {
    const lat = r.latitude != null ? Number(r.latitude) : NaN
    const lng = r.longitude != null ? Number(r.longitude) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue // can't place it

    const value = Number(r.construction_value ?? 0) || 0
    const received = r.received_date ?? undefined
    const issued = r.issued_date ?? undefined
    const updated = r.most_recent_issued_received_date ?? issued ?? received ?? new Date().toISOString()
    const desc = (r.description ?? '').trim()
    const title = desc || `${titleCase(r.type_permit ?? 'Building')} permit`

    const changedParts = [
      `Permit ${issued ? 'issued' : 'received'}${received ? ' ' + received.slice(0, 10) : ''}`,
      value > 0 ? `valuation $${value.toLocaleString()}` : null,
      r.address ? titleCase(r.address) : null,
    ].filter(Boolean)

    events.push({
      id: `marin-permit-${r.unique_id ?? r.permit_number ?? `${lat},${lng}`}`,
      title: title.length > 90 ? title.slice(0, 88) + '…' : title,
      eventType: 'building_permit',
      status: 'new',
      firstSeenAt: received ?? updated,
      latestUpdateAt: updated,
      geo: {
        latitude: lat, longitude: lng,
        cities: r.city_town ? [r.city_town] : undefined,
        zipCodes: r.zipcode ? [r.zipcode] : undefined,
        counties: ['Marin County'],
      },
      consequenceScore: permitConsequence(value),
      confidence: 'high',
      sources: [{ type: 'public_record', label: 'Marin County permits', url: DATASET_URL, observedAt: updated, status: 'confirmed' }],
      whatChanged: changedParts.join(' · '),
    })
  }
  // 'recency' preserves the input order (rows arrive newest-first); otherwise
  // rank by consequence (valuation).
  if (opts.sort !== 'recency') events.sort((a, b) => b.consequenceScore - a.consequenceScore)
  return opts.limit != null ? events.slice(0, opts.limit) : events
}

// Live fetch: most-recent permits, then normalize (which ranks by valuation).
export async function fetchMarinPermits(limit = 6, sort: 'consequence' | 'recency' = 'consequence'): Promise<LocalEvent[]> {
  const url = `https://data.marincounty.gov/resource/${DATASET}.json?$order=received_date%20DESC&$limit=100`
  const res = await fetch(url, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`Marin permits HTTP ${res.status}`)
  return normalizeMarinPermits(await res.json(), { limit, sort })
}
