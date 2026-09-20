// Caltrans District 4 lane closures (Build C) — the CWWP2 LCS status feed
// (public JSON, no key). Planned/active freeway closures near the saved point,
// surfaced in "Roads & Incidents" alongside live 511 incidents. Complements
// 511 (live collisions) with scheduled construction/maintenance closures.
import type { LocalEvent } from '../types'
import { haversineMiles } from '../geography'
import { nearAnyAnchor, type Anchor } from '../anchors'

interface LcsBegin {
  beginRoute?: string
  beginNearbyPlace?: string
  beginCounty?: string
  beginLatitude?: string
  beginLongitude?: string
  beginFreeFormDescription?: string
}
interface LcsClosure {
  closureID?: string
  facility?: string
  typeOfClosure?: string // Full | Lane | Ramp | ...
  typeOfWork?: string
  estimatedDelay?: string
  lanesClosed?: string // "All" | numeric
  totalExistingLanes?: string
  isCHINReportable?: string
  closureTimestamp?: {
    closureStartDate?: string
    closureStartTime?: string
    closureStartEpoch?: string
    closureEndDate?: string
    closureEndTime?: string
    closureEndEpoch?: string
    isClosureEndIndefinite?: string
  }
}
interface LcsEntry {
  lcs?: {
    index?: string
    location?: { travelFlowDirection?: string; begin?: LcsBegin }
    closure?: LcsClosure
  }
}
interface LcsResponse { data?: LcsEntry[] }

function toEpoch(s?: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function normalizeLaneClosures(
  raw: LcsResponse,
  opts: {
    near: { lat: number; lng: number }
    radiusMiles?: number
    limit?: number
    lookaheadHours?: number
    counties?: string[] // if set, keep only closures whose begin county matches
    anchors?: Anchor[] // multi-place: keep closures near ANY anchor (overrides near/radius)
    now?: number // epoch seconds; defaults to real now
  },
): LocalEvent[] {
  const radius = opts.radiusMiles ?? 20
  const lookahead = (opts.lookaheadHours ?? 24) * 3600
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const countySet = opts.counties ? new Set(opts.counties.map(c => c.toLowerCase())) : null
  const events: Array<LocalEvent & { _score: number; _key: string }> = []

  for (const entry of raw?.data ?? []) {
    const l = entry.lcs
    const begin = l?.location?.begin
    const cl = l?.closure
    if (!begin || !cl) continue

    if (countySet && !countySet.has((begin.beginCounty ?? '').toLowerCase())) continue

    const lat = Number(begin.beginLatitude)
    const lng = Number(begin.beginLongitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (opts.anchors && opts.anchors.length > 0) {
      if (!nearAnyAnchor(lat, lng, opts.anchors).ok) continue
    } else if (haversineMiles(opts.near.lat, opts.near.lng, lat, lng) > radius) {
      continue
    }

    const ts = cl.closureTimestamp ?? {}
    const start = toEpoch(ts.closureStartEpoch)
    const end = toEpoch(ts.closureEndEpoch)
    const indefinite = (ts.isClosureEndIndefinite ?? 'false').toLowerCase() === 'true'
    // Keep closures that are active now or starting within the lookahead window.
    // Drop ones that have already ended (unless flagged indefinite).
    if (end != null && !indefinite && end < now) continue
    if (start != null && start > now + lookahead) continue

    const route = begin.beginRoute || 'Highway'
    const dir = l?.location?.travelFlowDirection
    const isFull = (cl.typeOfClosure ?? '').toLowerCase() === 'full'
    const lanesClosed = cl.lanesClosed ?? ''
    const totalLanes = cl.totalExistingLanes ?? ''

    // Score: full closures and "All lanes" rank highest; partial closures scale
    // with the fraction of lanes closed. CHIN-reportable gets a small bump.
    let score = 0.4
    if (isFull || lanesClosed.toLowerCase() === 'all') {
      score = 0.7
    } else {
      const closed = Number(lanesClosed)
      const total = Number(totalLanes)
      if (Number.isFinite(closed) && Number.isFinite(total) && total > 0) {
        score = 0.4 + 0.3 * Math.min(1, closed / total)
      }
    }
    if ((cl.isCHINReportable ?? 'false').toLowerCase() === 'true') score = Math.min(0.85, score + 0.05)

    const closureLabel = isFull ? 'Full closure' : (lanesClosed.toLowerCase() === 'all' ? 'Full closure' : 'Lane closure')
    // Prefer the free-form description (usually "at X"); fall back to "near <place>".
    const desc = begin.beginFreeFormDescription?.trim()
    const where = desc ? `${closureLabel} ${desc}` : begin.beginNearbyPlace ? `${closureLabel} near ${begin.beginNearbyPlace}` : closureLabel
    const title = [[route, dir].filter(Boolean).join(' '), where].join(' — ')

    const laneText =
      lanesClosed && lanesClosed.toLowerCase() !== 'all' && Number(totalLanes) > 0
        ? `${lanesClosed} of ${totalLanes} lanes`
        : lanesClosed.toLowerCase() === 'all'
          ? 'all lanes'
          : undefined
    const window =
      ts.closureStartTime && ts.closureEndTime
        ? `${ts.closureStartTime}–${ts.closureEndTime}`
        : indefinite
          ? 'until further notice'
          : undefined
    const delay = cl.estimatedDelay && cl.estimatedDelay.toLowerCase() !== 'not reported' ? `~${cl.estimatedDelay} delay` : undefined
    const whatChanged = [cl.typeOfWork, laneText, window, delay].filter(Boolean).join(' · ') || undefined

    const observedAt = start != null ? new Date(start * 1000).toISOString() : new Date(now * 1000).toISOString()

    // Collapse near-identical closures (same route + direction + work type) that
    // the LCS feed lists once per segment — e.g. six "SR-29 … Demolition" rows.
    const dedupeKey = [route, dir ?? '', cl.typeOfWork ?? '', cl.typeOfClosure ?? ''].join('|').toLowerCase()

    events.push({
      _score: score,
      _key: dedupeKey,
      id: `caltrans-lcs-${cl.closureID ?? l?.index ?? `${lat},${lng}`}`,
      title: title.length > 110 ? title.slice(0, 108) + '…' : title,
      eventType: 'traffic',
      status: start != null && start > now ? 'developing' : 'new',
      firstSeenAt: observedAt,
      latestUpdateAt: observedAt,
      geo: { latitude: lat, longitude: lng, counties: [begin.beginCounty ? `${begin.beginCounty} County` : 'Marin County'] },
      consequenceScore: score,
      confidence: 'high',
      sources: [{ type: 'official_alert', label: 'Caltrans QuickMap', url: 'https://quickmap.dot.ca.gov/', observedAt, status: 'confirmed' }],
      whatChanged,
    })
  }

  events.sort((a, b) => b._score - a._score)
  // Dedupe after ranking so the highest-scored representative of each group wins.
  const seen = new Set<string>()
  const deduped = events.filter(e => (seen.has(e._key) ? false : (seen.add(e._key), true)))
  const limited = opts.limit != null ? deduped.slice(0, opts.limit) : deduped
  return limited.map(({ _score, _key, ...e }) => { void _score; void _key; return e })
}

export async function fetchCaltransClosures(
  point: { lat: number; lng: number },
  opts: { radiusMiles?: number; limit?: number; lookaheadHours?: number; counties?: string[]; anchors?: Anchor[] } = {},
): Promise<LocalEvent[]> {
  const res = await fetch('https://cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json', {
    headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' },
  })
  if (!res.ok) throw new Error(`caltrans lcs HTTP ${res.status}`)
  return normalizeLaneClosures((await res.json()) as LcsResponse, {
    near: point,
    radiusMiles: opts.radiusMiles ?? 20,
    limit: opts.limit ?? 6,
    lookaheadHours: opts.lookaheadHours ?? 24,
    counties: opts.counties,
    anchors: opts.anchors,
  })
}
