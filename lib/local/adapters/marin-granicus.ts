// Marin County agendas (Build B) via the Granicus agenda RSS feed
// (ViewPublisherRSS.php) — the working path, since the Legistar public API is not
// enabled for Marin. Each item is a meeting with a direct AgendaViewer link.
// Deterministic parse only; per-item agenda extraction (dollar amounts, applicants)
// is a later LLM step. Feeds the "Your Government" section.
import type { LocalEvent } from '../types'

const BOS_FEED = 'https://marin.granicus.com/ViewPublisherRSS.php?view_id=33&mode=agendas'
const SOURCE_LABEL = 'Marin County Board of Supervisors'

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

// Meeting date from the "Meeting YYMMDD" code in the title; falls back to a
// trailing "Mon DD, YYYY", then to the publish date.
function meetingDate(title: string, pubDate: string): string | null {
  const code = title.match(/Meeting\s+(\d{2})(\d{2})(\d{2})/)
  if (code) return `20${code[1]}-${code[2]}-${code[3]}`
  const tail = title.match(/-\s*([A-Z][a-z]{2}\s+\d{1,2},\s*\d{4})\s*$/)
  const t = Date.parse(tail?.[1] ?? pubDate)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

export function parseGranicusAgendas(xml: string, opts: { now?: Date; limit?: number } = {}): LocalEvent[] {
  const now = opts.now ?? new Date()
  const cutoff = now.getTime() - 2 * 24 * 60 * 60 * 1000 // keep meetings from ~2 days ago onward
  const events: Array<LocalEvent & { _t: number }> = []

  for (const block of xml.split('<item>').slice(1)) {
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const pubDate = decode(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '')
    if (!title || !link) continue

    const date = meetingDate(title, pubDate)
    if (!date) continue
    const t = Date.parse(`${date}T00:00:00Z`)
    if (Number.isNaN(t) || t < cutoff) continue // drop past meetings

    events.push({
      _t: t,
      id: `marin-bos-${decode(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? link)}`,
      title,
      eventType: 'government_meeting',
      status: 'new',
      firstSeenAt: `${date}T00:00:00.000Z`,
      latestUpdateAt: pubDate ? new Date(Date.parse(pubDate) || t).toISOString() : `${date}T00:00:00.000Z`,
      geo: { counties: ['Marin County'] },
      consequenceScore: 0.5,
      confidence: 'high',
      sources: [{ type: 'public_record', label: SOURCE_LABEL, url: link, observedAt: pubDate, status: 'confirmed' }],
      whyItMatters: 'Board of Supervisors meeting — agenda published.',
    })
  }

  events.sort((a, b) => a._t - b._t) // soonest first
  const limited = (opts.limit != null ? events.slice(0, opts.limit) : events)
  return limited.map(({ _t, ...e }) => { void _t; return e })
}

export async function fetchMarinAgendas(limit = 5): Promise<LocalEvent[]> {
  const res = await fetch(BOS_FEED, { headers: { 'User-Agent': 'TopNewsClipsLocal/1.0 (neuner@gmail.com)' } })
  if (!res.ok) throw new Error(`Marin agendas HTTP ${res.status}`)
  return parseGranicusAgendas(await res.text(), { limit })
}
