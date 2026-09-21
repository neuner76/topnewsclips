// Caltrans District 4 traffic cameras (Build C) — the CWWP2 CCTV status feed
// (public JSON, no key). Surfaces the nearest in-service cameras as live traffic
// views on /local. Each camera has a static image URL refreshed every ~5 min.
import { haversineMiles } from '../geography'
import { nearestAnchorMiles, nearAnyAnchor, type Anchor } from '../anchors'

export interface LocalCamera {
  id: string
  name: string // raw display name, "TVxxx -- " prefix stripped
  label: string // human-readable: route stripped, Caltrans abbreviations expanded
  route: string
  county: string
  imageUrl: string // static JPG, refreshed ~5 min
  streamUrl?: string // HLS m3u8, if present
  lat: number
  lng: number
}

// Caltrans camera names are terse dispatch code — "US-101 : AT JNO CENTRAL SRF".
// Turn them into readable labels: strip the leading route (shown separately),
// drop the noise "AT", expand directional/structure codes, title-case the rest.
const CAM_ABBREV: Record<string, string> = {
  JNO: 'just north of', JSO: 'just south of', JEO: 'just east of', JWO: 'just west of',
  NOF: 'north of', SOF: 'south of', EOF: 'east of', WOF: 'west of',
  OC: 'overcrossing', UC: 'undercrossing', OH: 'overhead', PED: 'pedestrian',
  OFR: 'off-ramp', ONR: 'on-ramp', SRF: 'San Rafael', JCT: 'junction',
  AV: 'Ave', BL: 'Blvd', BLVD: 'Blvd', ST: 'St', RD: 'Rd', DR: 'Dr', LN: 'Ln', HWY: 'Hwy',
}
const LOWER_WORDS = new Set(['of', 'at', 'and', 'the'])

export function cleanCameraName(route: string, raw: string): string {
  let s = (raw ?? '').trim()
  // Strip a leading "<route> :" / "<route> -" prefix (route is shown on its own).
  if (route) s = s.replace(new RegExp(`^${route.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[:\\-]?\\s*`, 'i'), '')
  // Also strip any leading route token (some names cite a cross-route, e.g.
  // "US-101 : N101 at JCT 37" on an SR-37 camera).
  s = s.replace(/^(US|SR|I|CA)-?\d+\s*[:\-]\s*/i, '')
  s = s.replace(/^AT\s+/i, '') // leading "AT" is noise
  const words = s.split(/\s+/).filter(Boolean).map(w => {
    const up = w.toUpperCase()
    if (CAM_ABBREV[up]) return CAM_ABBREV[up]
    if (/^(US|SR|I|CA)-?\d+$/i.test(w)) return w.toUpperCase() // keep route tokens
    return w
  })
  const expanded = words.join(' ')
  // Title-case, keeping small joining words lowercase (unless first).
  return expanded.split(/\s+/).map((w, i) => {
    const lw = w.toLowerCase()
    if (i > 0 && LOWER_WORDS.has(lw)) return lw
    if (/^(US|SR|I|CA)-?\d+$/i.test(w)) return w.toUpperCase() // keep route tokens
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  }).join(' ').trim() || (route || 'Traffic camera')
}

interface CctvEntry {
  cctv?: {
    index?: string
    inService?: string
    location?: { locationName?: string; route?: string; county?: string; latitude?: string; longitude?: string }
    imageData?: { streamingVideoURL?: string; static?: { currentImageURL?: string } }
  }
}
interface CctvResponse { data?: CctvEntry[] }

export function parseCctvCameras(raw: CctvResponse): LocalCamera[] {
  const out: LocalCamera[] = []
  for (const entry of raw?.data ?? []) {
    const c = entry.cctv
    if (!c || c.inService !== 'true') continue
    const loc = c.location ?? {}
    const lat = Number(loc.latitude)
    const lng = Number(loc.longitude)
    const imageUrl = c.imageData?.static?.currentImageURL
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !imageUrl) continue
    const name = (loc.locationName ?? '').replace(/^TV\w+\s*--\s*/i, '').trim() || loc.route || 'Traffic camera'
    out.push({
      id: c.index ?? `${lat},${lng}`,
      name,
      label: cleanCameraName(loc.route ?? '', name),
      route: loc.route ?? '',
      county: loc.county ?? '',
      imageUrl,
      streamUrl: c.imageData?.streamingVideoURL || undefined,
      lat,
      lng,
    })
  }
  return out
}

export function nearbyCameras(
  cameras: LocalCamera[],
  opts: { near: { lat: number; lng: number }; radiusMiles?: number; limit?: number; anchors?: Anchor[] },
): LocalCamera[] {
  const radius = opts.radiusMiles ?? 15
  const anchors = opts.anchors
  const withDist = cameras
    .map(c => anchors && anchors.length > 0
      ? { c, d: nearestAnchorMiles(c.lat, c.lng, anchors), ok: nearAnyAnchor(c.lat, c.lng, anchors).ok }
      : { c, d: haversineMiles(opts.near.lat, opts.near.lng, c.lat, c.lng), ok: haversineMiles(opts.near.lat, opts.near.lng, c.lat, c.lng) <= radius })
    .filter(x => x.ok)
    .sort((a, b) => a.d - b.d)
  const capped = opts.limit != null ? withDist.slice(0, opts.limit) : withDist
  return capped.map(x => x.c)
}

export async function fetchCaltransCameras(
  point: { lat: number; lng: number },
  opts: { radiusMiles?: number; limit?: number; anchors?: Anchor[] } = {},
): Promise<LocalCamera[]> {
  const res = await fetch('https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json', {
    headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' },
  })
  if (!res.ok) throw new Error(`caltrans cctv HTTP ${res.status}`)
  return nearbyCameras(parseCctvCameras(await res.json()), {
    near: point,
    radiusMiles: opts.radiusMiles ?? 15,
    limit: opts.limit ?? 6,
    anchors: opts.anchors,
  })
}
