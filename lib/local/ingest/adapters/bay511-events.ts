import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import { haversineMiles } from '../../geography'

// 511 SF Bay traffic events (Open511) as an ingestion source. Parsing mirrors the
// live digest adapter (lib/local/adapters/bay511.ts) but emits the §5.1 shapes and
// does region scoping only (no per-user anchor filtering — proximity is per-user
// ranking, later, §9). Marin + its approaches (US-101 / CA-1 / RSR corridor).
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_CENTER = { lat: 37.9735, lng: -122.5311 } // San Rafael
const REGION_RADIUS_MILES = 30

interface Open511Road { name?: string; direction?: string }
interface Open511Event {
  id?: string
  status?: string
  headline?: string
  event_type?: string
  severity?: string
  created?: string
  updated?: string
  geography?: { coordinates?: unknown }
  roads?: Open511Road[]
}

function eventPoint(geo?: Open511Event['geography']): { lat: number; lng: number } | null {
  let c: unknown = geo?.coordinates
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') return { lat: c[1], lng: c[0] }
  return null
}

// US-101, CA-1, I-580 (RSR bridge), CA-37 — the routes whose closure isolates a
// community, so §9 importance gets the +25 major-route bump.
const MAJOR_ROUTE_RE = /\b101\b|u\.?s\.?-?101|\bca[- ]?1\b|\bsr[- ]?1\b|highway 1|\bhwy 1\b|\b580\b|\b37\b|sir francis drake|richmond[- ]san rafael/i

function eventTypeFor(raw511Type?: string): string {
  return (raw511Type ?? '').toUpperCase() === 'CONSTRUCTION' ? 'road_closure' : 'road_incident'
}

export function parse511TrafficItems(
  body: unknown,
  opts: { center?: { lat: number; lng: number }; radiusMiles?: number } = {},
): NormalizedItem[] {
  const center = opts.center ?? MARIN_CENTER
  const radius = opts.radiusMiles ?? REGION_RADIUS_MILES
  const events = (body as { events?: Open511Event[] })?.events ?? []
  const items: NormalizedItem[] = []

  for (const ev of events) {
    if ((ev.status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE') continue
    const pt = eventPoint(ev.geography)
    if (!pt) continue
    if (haversineMiles(center.lat, center.lng, pt.lat, pt.lng) > radius) continue

    const roads = (ev.roads ?? []).map(r => [r.name, r.direction].filter(Boolean).join(' ')).filter(Boolean)
    const roadText = roads.join(', ')
    const headline = ev.headline || [roadText, (ev.event_type ?? '').toLowerCase()].filter(Boolean).join(' — ') || 'Traffic incident'
    const updated = ev.updated || ev.created || undefined
    const id = ev.id ?? `${pt.lat},${pt.lng}`

    items.push({
      externalId: id,
      // Exclude the volatile `updated` timestamp: 511 re-stamps it every poll even
      // when nothing material changed, which otherwise re-inserts unchanged incidents
      // as new source_items every cycle. Hash the material fields only; the event's
      // freshness comes from last_seen_at (bumped each cycle), and the dedupe key is
      // the incident id, so matching is unaffected.
      contentHash: hashContent([id, ev.status, ev.headline, ev.severity]),
      title: headline.length > 110 ? headline.slice(0, 108) + '…' : headline,
      url: 'https://511.org/',
      publishedAt: updated,
      placeText: roadText || undefined,
      geo: { lat: pt.lat, lng: pt.lng, precision: 'segment' },
      extracted: {
        eventType: eventTypeFor(ev.event_type),
        severity: ev.severity,
        majorRoute: MAJOR_ROUTE_RE.test(`${roadText} ${headline}`),
        startedAt: ev.created || updated,
      },
    })
  }
  return items
}

export function bay511EventToCandidate(item: NormalizedItem): EventCandidate {
  const ex = item.extracted ?? {}
  return {
    eventType: String(ex.eventType ?? 'road_incident'),
    dedupeKey: `511-traffic-events:${item.externalId ?? item.contentHash}`,
    headline: item.title,
    summary: item.placeText ? String(item.placeText) : undefined,
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
    fields: { severity: ex.severity, majorRoute: !!ex.majorRoute },
  }
}

export const bay511EventsAdapter: SourceAdapter = {
  slug: '511-traffic-events',
  resolvesByAbsence: true, // live events feed: gone = cleared
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const key = process.env.BAY511_API_KEY
    if (!key) return [] // no key → nothing to ingest (source stays healthy)
    const res = await fetch(`https://api.511.org/traffic/events?api_key=${key}&format=json`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`511 HTTP ${res.status}`)
    const text = (await res.text()).replace(/^﻿/, '') // strip UTF-8 BOM
    return [{ body: JSON.parse(text), contentType: 'application/json', url: 'https://api.511.org/traffic/events', fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parse511TrafficItems(raw.body)
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return [bay511EventToCandidate(item)]
  },
}
