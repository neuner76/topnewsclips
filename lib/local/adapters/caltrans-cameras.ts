// Caltrans District 4 traffic cameras (Build C) — the CWWP2 CCTV status feed
// (public JSON, no key). Surfaces the nearest in-service cameras as live traffic
// views on /local. Each camera has a static image URL refreshed every ~5 min.
import { haversineMiles } from '../geography'

export interface LocalCamera {
  id: string
  name: string // display name, "TVxxx -- " prefix stripped
  route: string
  county: string
  imageUrl: string // static JPG, refreshed ~5 min
  streamUrl?: string // HLS m3u8, if present
  lat: number
  lng: number
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
    out.push({
      id: c.index ?? `${lat},${lng}`,
      name: (loc.locationName ?? '').replace(/^TV\w+\s*--\s*/i, '').trim() || loc.route || 'Traffic camera',
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
  opts: { near: { lat: number; lng: number }; radiusMiles?: number; limit?: number },
): LocalCamera[] {
  const radius = opts.radiusMiles ?? 15
  const withDist = cameras
    .map(c => ({ c, d: haversineMiles(opts.near.lat, opts.near.lng, c.lat, c.lng) }))
    .filter(x => x.d <= radius)
    .sort((a, b) => a.d - b.d)
  const capped = opts.limit != null ? withDist.slice(0, opts.limit) : withDist
  return capped.map(x => x.c)
}

export async function fetchCaltransCameras(
  point: { lat: number; lng: number },
  opts: { radiusMiles?: number; limit?: number } = {},
): Promise<LocalCamera[]> {
  const res = await fetch('https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json', {
    headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' },
  })
  if (!res.ok) throw new Error(`caltrans cctv HTTP ${res.status}`)
  return nearbyCameras(parseCctvCameras(await res.json()), {
    near: point,
    radiusMiles: opts.radiusMiles ?? 15,
    limit: opts.limit ?? 6,
  })
}
