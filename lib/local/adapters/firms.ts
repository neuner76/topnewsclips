// NASA FIRMS — active-fire / thermal-anomaly detections (Build C), feeds the
// "Thermal anomalies" stat in Your Environment. The area API returns CSV of
// satellite fire detections in a bounding box; we count the ones near the saved
// point (nominal/high confidence). Needs a free FIRMS map key (NASA_FIRMS_MAP_KEY).
import { haversineMiles } from '../geography'

export interface FirmsDetection {
  lat: number
  lng: number
  confidence: string // VIIRS: 'l' | 'n' | 'h'; MODIS: 0-100
  acqDate: string
}

export function parseFirmsCsv(csv: string): FirmsDetection[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const iLat = header.indexOf('latitude')
  const iLng = header.indexOf('longitude')
  const iConf = header.indexOf('confidence')
  const iDate = header.indexOf('acq_date')
  if (iLat < 0 || iLng < 0) return []

  const out: FirmsDetection[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const c = line.split(',')
    const lat = Number(c[iLat])
    const lng = Number(c[iLng])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    out.push({ lat, lng, confidence: (iConf >= 0 ? c[iConf] : '').trim().toLowerCase(), acqDate: iDate >= 0 ? c[iDate] : '' })
  }
  return out
}

// Low-confidence VIIRS detections ('l') and MODIS < 30 are noisy — skip them.
function isConfident(confidence: string): boolean {
  if (confidence === 'l' || confidence === 'low') return false
  const n = Number(confidence)
  if (Number.isFinite(n)) return n >= 30
  return true // 'n' | 'h' | 'nominal' | 'high' | unknown-but-not-low
}

export function normalizeFirms(
  rows: FirmsDetection[],
  opts: { near: { lat: number; lng: number }; radiusMiles?: number },
): { count: number; nearestMiles?: number } {
  const radius = opts.radiusMiles ?? 25
  let count = 0
  let nearest = Infinity
  for (const d of rows) {
    if (!isConfident(d.confidence)) continue
    const dist = haversineMiles(opts.near.lat, opts.near.lng, d.lat, d.lng)
    if (dist <= radius) {
      count++
      if (dist < nearest) nearest = dist
    }
  }
  return count > 0 ? { count, nearestMiles: Math.round(nearest) } : { count: 0 }
}

export async function fetchFirms(
  point: { lat: number; lng: number },
  apiKey: string,
  opts: { radiusMiles?: number; source?: string } = {},
): Promise<{ count: number; nearestMiles?: number }> {
  const radius = opts.radiusMiles ?? 25
  const dLat = radius / 69
  const dLng = radius / (69 * Math.cos((point.lat * Math.PI) / 180))
  const bbox = `${point.lng - dLng},${point.lat - dLat},${point.lng + dLng},${point.lat + dLat}`
  const source = opts.source ?? 'VIIRS_SNPP_NRT'
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/1`
  const res = await fetch(url, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`)
  return normalizeFirms(parseFirmsCsv(await res.text()), { near: point, radiusMiles: radius })
}
