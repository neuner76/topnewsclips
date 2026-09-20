// Multi-place proximity. Each saved place contributes an "anchor" — a point with
// its own radius. A record is relevant if it falls within ANY anchor's radius;
// the distance we surface is to the NEAREST anchor. This replaces the old
// single-home-point model so, e.g., a Point Reyes item earns its place via the
// West Marin anchor instead of being dropped for being far from Novato.
import { haversineMiles } from './geography'

export interface Anchor {
  lat: number
  lng: number
  radiusMiles: number
  label?: string
}

// Distance (miles) to the closest anchor, or Infinity when there are none.
export function nearestAnchorMiles(lat: number, lng: number, anchors: Anchor[]): number {
  let min = Infinity
  for (const a of anchors) {
    const d = haversineMiles(lat, lng, a.lat, a.lng)
    if (d < min) min = d
  }
  return min
}

// Is the point inside any anchor's radius (+ optional pad)? Returns the nearest
// distance and the anchor that admitted it (the closest one within range).
export function nearAnyAnchor(
  lat: number,
  lng: number,
  anchors: Anchor[],
  opts: { padMiles?: number } = {},
): { ok: boolean; miles: number; anchor?: Anchor } {
  const pad = opts.padMiles ?? 0
  let best: { miles: number; anchor: Anchor } | null = null
  for (const a of anchors) {
    const d = haversineMiles(lat, lng, a.lat, a.lng)
    if (d <= a.radiusMiles + pad && (best == null || d < best.miles)) best = { miles: d, anchor: a }
  }
  if (best) return { ok: true, miles: best.miles, anchor: best.anchor }
  return { ok: false, miles: nearestAnchorMiles(lat, lng, anchors) }
}
