// NWS active alerts (Marin) — the first §5.1 adapter (D7 wrap). Produces
// weather_alert / coastal_flood event candidates. Pure parsing (parseNwsAlertItems,
// nwsAlertToCandidates) is unit-tested against a fixture; fetch is thin I/O.
import type { SourceAdapter, NormalizedItem, EventCandidate } from '../types'
import { hashContent } from '../content-hash'

const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const MARIN_POINT = { lat: 37.9735, lng: -122.5311 } // central Marin (San Rafael)

interface NwsAlertFeature {
  id?: string
  properties?: {
    id?: string
    '@id'?: string
    event?: string
    severity?: string
    headline?: string
    description?: string
    areaDesc?: string
    onset?: string | null
    sent?: string | null
    expires?: string | null
  }
}
interface NwsAlertsResponse { features?: NwsAlertFeature[] }

// Raw alerts JSON -> normalized source items (one per active alert).
export function parseNwsAlertItems(body: unknown): NormalizedItem[] {
  const features = (body as NwsAlertsResponse)?.features ?? []
  const out: NormalizedItem[] = []
  for (const f of features) {
    const p = f.properties ?? {}
    const id = p.id ?? p['@id'] ?? f.id
    if (!id) continue
    out.push({
      externalId: id,
      // onset/expires/severity change over an alert's life; include them so an
      // update produces a new item (and a corrections/timeline entry downstream).
      contentHash: hashContent([id, p.event, p.severity, p.headline, p.onset, p.expires]),
      title: p.event,
      bodyText: p.headline || p.description || undefined,
      url: p['@id'] ?? id,
      publishedAt: p.onset ?? p.sent ?? undefined,
      placeText: p.areaDesc,
      // Alerts are zone polygons; leave geo to the geolocation stage (place_text).
      extracted: { event: p.event, severity: p.severity, area: p.areaDesc, onset: p.onset, expires: p.expires },
    })
  }
  return out
}

// A normalized alert -> its event candidate (weather_alert, or coastal_flood).
export function nwsAlertToCandidates(item: NormalizedItem): EventCandidate[] {
  const event = String(item.extracted?.event ?? item.title ?? 'Weather alert')
  const isCoastalFlood = /coastal flood/i.test(event)
  return [{
    eventType: isCoastalFlood ? 'coastal_flood' : 'weather_alert',
    dedupeKey: `nws-alerts-marin:${item.externalId ?? item.contentHash}`,
    headline: event,
    summary: item.bodyText,
    startedAt: item.publishedAt,
    sourceRole: 'origin',
    fields: {
      severity: item.extracted?.severity,
      expires: item.extracted?.expires,
      area: item.extracted?.area,
    },
  }]
}

export const nwsAlertsAdapter: SourceAdapter = {
  slug: 'nws-alerts-marin',
  async fetch() {
    const url = `https://api.weather.gov/alerts/active?point=${MARIN_POINT.lat},${MARIN_POINT.lng}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`NWS alerts HTTP ${res.status}`)
    return [{ body: await res.json(), contentType: 'application/json', url, fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw) {
    return parseNwsAlertItems(raw.body)
  },
  toEventCandidates(item) {
    return nwsAlertToCandidates(item)
  },
}
