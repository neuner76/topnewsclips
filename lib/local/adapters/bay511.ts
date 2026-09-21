// 511 SF Bay — traffic incidents & road conditions (Build C), the "Roads &
// Incidents" section. Open511 traffic-events feed (api.511.org). We pull the
// Bay-wide active events and keep the ones near the saved point. Needs a free
// 511 API token (BAY511_API_KEY). Note: 511 JSON is served with a UTF-8 BOM that
// breaks JSON.parse, so fetch text and strip it.
import type { LocalEvent } from '../types'
import { haversineMiles } from '../geography'
import { nearAnyAnchor, type Anchor } from '../anchors'

interface Open511Road { name?: string; direction?: string; state?: string; article?: string }
interface Open511Event {
  id?: string
  status?: string // ACTIVE | ARCHIVED
  headline?: string
  event_type?: string // INCIDENT | CONSTRUCTION | ROAD_CONDITION | WEATHER_CONDITION | SPECIAL_EVENT
  severity?: string // Minor | Moderate | Major | Unknown
  created?: string
  updated?: string
  geography?: { type?: string; coordinates?: unknown }
  roads?: Open511Road[]
}
interface Bay511Response { events?: Open511Event[] }

const SEVERITY_SCORE: Record<string, number> = { major: 0.75, moderate: 0.5, minor: 0.3, unknown: 0.3 }

// First [lng, lat] pair from Point / LineString / Multi* geometry.
function eventPoint(geo?: Open511Event['geography']): { lat: number; lng: number } | null {
  let c: unknown = geo?.coordinates
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return { lat: c[1], lng: c[0] }
  }
  return null
}

export function normalize511Events(
  raw: Bay511Response,
  opts: { near: { lat: number; lng: number }; radiusMiles?: number; limit?: number; anchors?: Anchor[] },
): LocalEvent[] {
  const radius = opts.radiusMiles ?? 15
  const events: Array<LocalEvent & { _sev: number }> = []

  for (const ev of raw?.events ?? []) {
    if ((ev.status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE') continue
    const pt = eventPoint(ev.geography)
    if (!pt) continue
    if (opts.anchors && opts.anchors.length > 0) {
      if (!nearAnyAnchor(pt.lat, pt.lng, opts.anchors).ok) continue
    } else if (haversineMiles(opts.near.lat, opts.near.lng, pt.lat, pt.lng) > radius) {
      continue
    }

    const sev = SEVERITY_SCORE[(ev.severity ?? 'unknown').toLowerCase()] ?? 0.3
    const roads = (ev.roads ?? []).map(r => [r.name, r.direction].filter(Boolean).join(' ')).filter(Boolean)
    const title = ev.headline || [roads.join(', '), (ev.event_type ?? '').toLowerCase()].filter(Boolean).join(' — ') || 'Traffic incident'
    const updated = ev.updated || ev.created || new Date().toISOString()

    events.push({
      _sev: sev,
      id: `bay511-${ev.id ?? `${pt.lat},${pt.lng}`}`,
      title: title.length > 110 ? title.slice(0, 108) + '…' : title,
      eventType: 'traffic',
      status: 'new',
      firstSeenAt: ev.created || updated,
      latestUpdateAt: updated,
      geo: { latitude: pt.lat, longitude: pt.lng, counties: ['Marin County'] },
      consequenceScore: sev,
      confidence: 'high',
      sources: [{ type: 'official_alert', label: '511 SF Bay', url: 'https://511.org/', observedAt: updated, status: 'confirmed' }],
      whatChanged: [ev.severity ? `${ev.severity} severity` : null, roads.length ? roads.join(', ') : null].filter(Boolean).join(' · ') || undefined,
    })
  }

  events.sort((a, b) => b._sev - a._sev)
  const limited = opts.limit != null ? events.slice(0, opts.limit) : events
  return limited.map(({ _sev, ...e }) => { void _sev; return e })
}

export async function fetch511Events(
  apiKey: string,
  point: { lat: number; lng: number },
  opts: { radiusMiles?: number; limit?: number; anchors?: Anchor[] } = {},
): Promise<LocalEvent[]> {
  const url = `https://api.511.org/traffic/events?api_key=${apiKey}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`511 HTTP ${res.status}`)
  // 511 JSON carries a UTF-8 BOM; strip it before parsing.
  const text = (await res.text()).replace(/^﻿/, '')
  const json = JSON.parse(text) as Bay511Response
  return normalize511Events(json, { near: point, radiusMiles: opts.radiusMiles ?? 15, limit: opts.limit ?? 6, anchors: opts.anchors })
}
