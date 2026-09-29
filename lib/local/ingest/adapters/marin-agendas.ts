import type { SourceAdapter, NormalizedItem, EventCandidate, RawPayload, FetchContext } from '../types'
import { hashContent } from '../content-hash'
import { meetingDate } from '../../adapters/marin-granicus'

// Marin County Board of Supervisors agendas via the Granicus RSS feed as a §7
// ingestion source. Deterministic parse only — per-item agenda extraction (dollar
// amounts, applicants, votes) is a later LLM stage (§7.5), not ingestion. Each
// upcoming/recent meeting → a government_action candidate. These land HELD
// (government_action.auto_publish=false): meetings are surfaced through the review
// path, not auto-published. Venue is the Marin Civic Center (city precision).
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'
const BOS_FEED = 'https://marin.granicus.com/ViewPublisherRSS.php?view_id=33&mode=agendas'
const CIVIC_CENTER = { lat: 37.9962, lng: -122.5307 } // Marin Civic Center, San Rafael

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

export function parseAgendaItems(xml: string, opts: { now?: Date } = {}): NormalizedItem[] {
  const now = opts.now ?? new Date()
  const cutoff = now.getTime() - 2 * 24 * 60 * 60 * 1000 // keep meetings from ~2 days ago onward
  const items: NormalizedItem[] = []

  for (const block of String(xml).split('<item>').slice(1)) {
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const pubDate = decode(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '')
    if (!title || !link) continue

    const date = meetingDate(title, pubDate)
    if (!date) continue
    const t = Date.parse(`${date}T00:00:00Z`)
    if (Number.isNaN(t) || t < cutoff) continue // drop past meetings

    const guid = decode(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? link)
    const startedAt = `${date}T00:00:00.000Z`

    items.push({
      externalId: guid,
      contentHash: hashContent([guid, title, date, pubDate]),
      title,
      url: link,
      publishedAt: pubDate ? new Date(Date.parse(pubDate) || t).toISOString() : startedAt,
      placeText: 'Marin Civic Center, San Rafael',
      geo: { lat: CIVIC_CENTER.lat, lng: CIVIC_CENTER.lng, precision: 'city' },
      extracted: { startedAt },
    })
  }
  return items
}

export function agendaItemToCandidate(item: NormalizedItem): EventCandidate {
  const ex = item.extracted ?? {}
  return {
    eventType: 'government_action',
    dedupeKey: `marin-bos-agendas:${item.externalId ?? item.contentHash}`,
    headline: item.title,
    summary: 'Board of Supervisors meeting — agenda published.',
    startedAt: (ex.startedAt as string) ?? item.publishedAt,
    geo: item.geo,
    sourceRole: 'origin',
  }
}

export const marinAgendasAdapter: SourceAdapter = {
  slug: 'marin-bos-agendas',
  async fetch(_ctx: FetchContext): Promise<RawPayload[]> {
    void _ctx
    const res = await fetch(BOS_FEED, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Marin agendas HTTP ${res.status}`)
    return [{ body: await res.text(), contentType: 'application/rss+xml', url: BOS_FEED, fetchedAt: new Date().toISOString() }]
  },
  async normalize(raw: RawPayload): Promise<NormalizedItem[]> {
    return parseAgendaItems(String(raw.body))
  },
  toEventCandidates(item: NormalizedItem): EventCandidate[] {
    return [agendaItemToCandidate(item)]
  },
}
