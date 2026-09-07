// USGS earthquakes adapter — GeoJSON -> quake summaries, optionally filtered to a
// radius around a saved place with computed distance.
import type { QuakeSummary } from './types'
import { haversineMiles } from '../geography'

interface UsgsRaw { features?: Array<{ properties?: { mag?: number; place?: string; time?: number }; geometry?: { coordinates?: number[] } }> }

interface UsgsOpts { near?: { latitude: number; longitude: number }; radiusMiles?: number; minMagnitude?: number }

export function normalizeUsgsEarthquakes(raw: UsgsRaw, opts: UsgsOpts = {}): QuakeSummary[] {
  const out: QuakeSummary[] = []
  for (const f of raw.features ?? []) {
    const [lng, lat] = f.geometry?.coordinates ?? []
    if (lat == null || lng == null) continue
    const magnitude = f.properties?.mag ?? 0
    if (opts.minMagnitude != null && magnitude < opts.minMagnitude) continue
    const distanceMiles = opts.near ? haversineMiles(lat, lng, opts.near.latitude, opts.near.longitude) : undefined
    if (opts.radiusMiles != null && (distanceMiles ?? Infinity) > opts.radiusMiles) continue
    out.push({
      magnitude,
      place: f.properties?.place ?? '',
      time: f.properties?.time != null ? new Date(f.properties.time).toISOString() : '',
      latitude: lat,
      longitude: lng,
      distanceMiles,
    })
  }
  return out.sort((a, b) => b.time.localeCompare(a.time))
}
