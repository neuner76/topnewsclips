// CAL FIRE active incidents (emergency layer) — named wildfires with location,
// acreage, and containment from the public incidents.fire.ca.gov feed. Feeds
// Need To Know Near You: a named, active fire in/near your county is genuinely
// act-now information, and unlike a FIRMS satellite heat dot it's a confirmed,
// tracked incident. Public JSON, no key.
import type { LocalEvent } from '../types'
import { haversineMiles } from '../geography'
import { nearestAnchorMiles, type Anchor } from '../anchors'

export interface CalFireIncident {
  id: string
  name: string
  county: string
  location: string
  acres: number
  percentContained: number
  started?: string
  updated?: string
  url?: string
  lat: number
  lng: number
}

interface CalFireRaw {
  Name?: string
  Final?: boolean
  IsActive?: boolean
  ExtinguishedDate?: string | null
  County?: string
  Location?: string
  AcresBurned?: number
  PercentContained?: number
  Started?: string
  Updated?: string
  Url?: string
  UniqueId?: string
  Latitude?: number
  Longitude?: number
}

export function parseCalFireIncidents(raw: CalFireRaw[]): CalFireIncident[] {
  const out: CalFireIncident[] = []
  for (const r of raw ?? []) {
    // Active only: not flagged Final, not extinguished, IsActive not explicitly false.
    if (r.Final === true) continue
    if (r.ExtinguishedDate) continue
    if (r.IsActive === false) continue
    const lat = Number(r.Latitude)
    const lng = Number(r.Longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    out.push({
      id: r.UniqueId || `${lat},${lng}`,
      name: (r.Name ?? 'Wildfire').trim(),
      county: r.County ?? '',
      location: (r.Location ?? '').trim(),
      acres: Number(r.AcresBurned) || 0,
      percentContained: Number(r.PercentContained) || 0,
      started: r.Started ?? undefined,
      updated: r.Updated ?? undefined,
      url: r.Url ?? undefined,
      lat,
      lng,
    })
  }
  return out
}

export function normalizeCalFire(
  raw: CalFireRaw[],
  opts: {
    near?: { lat: number; lng: number }
    anchors?: Anchor[]
    radiusMiles?: number // wildfire relevance radius (wider than tight place radii)
    includeContained?: boolean
    limit?: number
  },
): LocalEvent[] {
  const radius = opts.radiusMiles ?? 40
  const events: Array<LocalEvent & { _score: number }> = []

  for (const inc of parseCalFireIncidents(raw)) {
    if (!opts.includeContained && inc.percentContained >= 100) continue // fully contained = not act-now
    const dist =
      opts.anchors && opts.anchors.length > 0
        ? nearestAnchorMiles(inc.lat, inc.lng, opts.anchors)
        : opts.near
          ? haversineMiles(opts.near.lat, opts.near.lng, inc.lat, inc.lng)
          : 0
    if (dist > radius) continue

    // Nearer + less-contained ranks higher; a named fire in-county is top priority.
    let score = 0.9
    if (dist <= 15) score += 0.05
    score -= (inc.percentContained / 100) * 0.12
    score = Math.max(0.75, Math.min(0.97, score))

    const acresText = inc.acres > 0 ? `${Math.round(inc.acres).toLocaleString()} ac` : null
    const distText = dist > 0 ? `~${Math.round(dist)} mi away` : null
    const updated = inc.updated || inc.started || new Date().toISOString()
    events.push({
      _score: score,
      id: `calfire-${inc.id}`,
      title: `${inc.name} — ${[acresText, `${Math.round(inc.percentContained)}% contained`].filter(Boolean).join(', ')}`,
      eventType: 'fire',
      status: 'ongoing',
      firstSeenAt: inc.started || updated,
      latestUpdateAt: updated,
      geo: { latitude: inc.lat, longitude: inc.lng, counties: [inc.county ? `${inc.county} County` : 'Marin County'] },
      consequenceScore: score,
      confidence: 'high',
      sources: [{ type: 'official_alert', label: 'CAL FIRE', url: inc.url || 'https://incidents.fire.ca.gov/', observedAt: updated, status: 'confirmed' }],
      whatChanged: [inc.location, distText].filter(Boolean).join(' · ') || undefined,
    })
  }

  events.sort((a, b) => b._score - a._score)
  const limited = opts.limit != null ? events.slice(0, opts.limit) : events
  return limited.map(({ _score, ...e }) => { void _score; return e })
}

export async function fetchCalFire(
  opts: { near?: { lat: number; lng: number }; anchors?: Anchor[]; radiusMiles?: number; limit?: number } = {},
): Promise<LocalEvent[]> {
  const res = await fetch('https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false', {
    headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' },
  })
  if (!res.ok) throw new Error(`CAL FIRE HTTP ${res.status}`)
  return normalizeCalFire((await res.json()) as CalFireRaw[], {
    near: opts.near,
    anchors: opts.anchors,
    radiusMiles: opts.radiusMiles ?? 40,
    limit: opts.limit ?? 4,
  })
}
