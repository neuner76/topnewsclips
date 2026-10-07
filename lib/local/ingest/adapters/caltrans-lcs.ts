import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import { mapLink } from '../../geography'

// Caltrans D4 lane-closure system (LCS) as an ingestion source. Parsing mirrors the
// live digest adapter (lib/local/adapters/caltrans-lcs.ts) but emits the §5.1 shapes
// and scopes by COUNTY (Marin + Sonoma) rather than per-user anchors. Closures that
// have already ended, or start beyond the look-ahead window, are dropped.
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const DEFAULT_COUNTIES = ['marin', 'sonoma']

interface LcsBegin {
  beginRoute?: string; beginNearbyPlace?: string; beginCounty?: string
  beginLatitude?: string; beginLongitude?: string; beginFreeFormDescription?: string
}
interface LcsClosure {
  closureID?: string; typeOfClosure?: string; typeOfWork?: string
  estimatedDelay?: string; lanesClosed?: string; totalExistingLanes?: string; isCHINReportable?: string
  closureTimestamp?: { closureStartEpoch?: string; closureEndEpoch?: string; isClosureEndIndefinite?: string }
}
interface LcsEntry {
  lcs?: { index?: string; location?: { travelFlowDirection?: string; begin?: LcsBegin }; closure?: LcsClosure }
}

function toEpoch(s?: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

const MAJOR_ROUTE_RE = /\b101\b|u\.?s\.?-?101|\bca[- ]?1\b|\bsr[- ]?1\b|highway 1|\bhwy 1\b|\b580\b|\b37\b|sir francis drake|richmond[- ]san rafael/i

// Closure impact for the card summary — work type · lane extent · estimated delay —
// so a Roads update conveys HOW disruptive it is, not just that it exists. Delay is
// Caltrans' own estimate (often "Not Reported", in which case the lane extent carries
// the signal). This is scheduled-closure impact, not live traffic flow.
export function lcsImpactSummary(p: {
  typeOfWork?: string; isFull?: boolean; lanesClosed?: string; totalExistingLanes?: string; estimatedDelay?: string
}): string | undefined {
  const parts: string[] = []
  if (p.typeOfWork && p.typeOfWork.trim()) parts.push(p.typeOfWork.trim())
  const lanesClosed = (p.lanesClosed ?? '').trim()
  const total = Number(p.totalExistingLanes)
  if (p.isFull || lanesClosed.toLowerCase() === 'all') parts.push('all lanes')
  else if (lanesClosed && Number.isFinite(Number(lanesClosed)) && Number.isFinite(total) && total > 0) {
    parts.push(`${lanesClosed} of ${total} lanes`)
  }
  const delay = (p.estimatedDelay ?? '').trim()
  if (delay && delay.toLowerCase() !== 'not reported' && delay !== '0') parts.push(`~${delay} delay`)
  return parts.length ? parts.join(' · ') : undefined
}

export function parseLcsItems(
  body: unknown,
  opts: { counties?: string[]; nowEpoch?: number; lookaheadHours?: number } = {},
): NormalizedItem[] {
  const countySet = new Set((opts.counties ?? DEFAULT_COUNTIES).map(c => c.toLowerCase()))
  const now = opts.nowEpoch ?? Math.floor(Date.now() / 1000)
  const lookahead = (opts.lookaheadHours ?? 24) * 3600
  const items: NormalizedItem[] = []

  for (const entry of (body as { data?: LcsEntry[] })?.data ?? []) {
    const l = entry.lcs
    const begin = l?.location?.begin
    const cl = l?.closure
    if (!begin || !cl) continue
    if (!countySet.has((begin.beginCounty ?? '').toLowerCase())) continue

    const lat = Number(begin.beginLatitude)
    const lng = Number(begin.beginLongitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const ts = cl.closureTimestamp ?? {}
    const start = toEpoch(ts.closureStartEpoch)
    const end = toEpoch(ts.closureEndEpoch)
    const indefinite = (ts.isClosureEndIndefinite ?? 'false').toLowerCase() === 'true'
    if (end != null && !indefinite && end < now) continue // already over
    if (start != null && start > now + lookahead) continue // too far out

    const route = begin.beginRoute || 'Highway'
    const dir = l?.location?.travelFlowDirection
    const isFull = (cl.typeOfClosure ?? '').toLowerCase() === 'full' || (cl.lanesClosed ?? '').toLowerCase() === 'all'
    const closureLabel = isFull ? 'Full closure' : 'Lane closure'
    const desc = begin.beginFreeFormDescription?.trim()
    const where = desc ? `${closureLabel} ${desc}` : begin.beginNearbyPlace ? `${closureLabel} near ${begin.beginNearbyPlace}` : closureLabel
    const headline = [[route, dir].filter(Boolean).join(' '), where].join(' — ')

    const startedAt = start != null ? new Date(start * 1000).toISOString() : new Date(now * 1000).toISOString()
    const externalId = cl.closureID ?? l?.index ?? `${lat},${lng}`

    items.push({
      externalId,
      contentHash: hashContent([externalId, cl.typeOfClosure, cl.lanesClosed, ts.closureStartEpoch, ts.closureEndEpoch]),
      title: headline.length > 110 ? headline.slice(0, 108) + '…' : headline,
      url: mapLink(lat, lng), // QuickMap has no per-closure page → pin the exact spot
      publishedAt: startedAt,
      placeText: begin.beginNearbyPlace || begin.beginCounty || undefined,
      geo: { lat, lng, precision: 'segment' },
      extracted: {
        eventType: 'road_closure',
        majorRoute: MAJOR_ROUTE_RE.test(`${route} ${desc ?? ''}`),
        typeOfWork: cl.typeOfWork,
        isFull,
        lanesClosed: cl.lanesClosed,
        totalExistingLanes: cl.totalExistingLanes,
        estimatedDelay: cl.estimatedDelay,
        // deterministic match key across re-fetches: route + direction + work + type
        dedupeKey: `caltrans-d4-lcs:${[route, dir ?? '', cl.typeOfWork ?? '', cl.typeOfClosure ?? ''].join('|').toLowerCase()}`,
        startedAt,
        future: start != null && start > now,
      },
    })
  }
  return items
}

export function lcsItemToCandidate(item: NormalizedItem): EventCandidate {
  const ex = item.extracted ?? {}
  return {
    eventType: String(ex.eventType ?? 'road_closure'),
    dedupeKey: String(ex.dedupeKey ?? `caltrans-d4-lcs:${item.externalId ?? item.contentHash}`),
    headline: item.title,
    summary: lcsImpactSummary({ typeOfWork: ex.typeOfWork as string, isFull: !!ex.isFull, lanesClosed: ex.lanesClosed as string, totalExistingLanes: ex.totalExistingLanes as string, estimatedDelay: ex.estimatedDelay as string }),
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { majorRoute: !!ex.majorRoute },
  }
}

export const caltransLcsAdapter: SourceAdapter = {
  slug: 'caltrans-d4-lcs',
  resolvesByAbsence: true, // current closures: gone = reopened/ended
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const res = await fetch('https://cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`caltrans lcs HTTP ${res.status}`)
    return [{ body: await res.json(), contentType: 'application/json', url: 'https://cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json', fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseLcsItems(raw.body)
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return [lcsItemToCandidate(item)]
  },
}
