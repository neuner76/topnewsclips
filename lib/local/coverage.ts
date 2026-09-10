// Local media coverage detector (Decisions › Local media coverage detector).
// Decides whether a public-record event has been covered by local journalism —
// the signal that turns "a big record" into "a big record no one covered" (a
// Local Blindspot). An outlet covers an event if it has an article within ±7 days
// of firstSeenAt matching 2+ of: entity/topic overlap, street address, or dollar
// amount (±5%). Pure and unit-tested. Display the raw outlet count, never a score.
import type { LocalEvent } from './types'
import type { LocalArticle } from './adapters/local-news'

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'that', 'this', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'had',
  'new', 'permit', 'county', 'marin', 'received', 'valuation', 'project',
])

function sigWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w))
  )
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n
}

// Extract dollar amounts, handling "$4,000,000" and "$4 million" / "4M" / "$250k".
function dollarAmounts(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(/\$\s?([\d,]+(?:\.\d+)?)(?!\s*(?:million|billion|thousand|[kmb]\b))/gi)) {
    const n = Number(m[1].replace(/,/g, ''))
    if (n > 0) out.push(n)
  }
  const scale: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, billion: 1e9, b: 1e9 }
  for (const m of s.matchAll(/\$?\s?(\d+(?:\.\d+)?)\s*(million|billion|thousand|[kmb])\b/gi)) {
    const n = Number(m[1]) * (scale[m[2].toLowerCase()] ?? 1)
    if (n > 0) out.push(n)
  }
  return out
}

// Leading "NUMBER STREETWORD" token (e.g. "100 main") from the event text.
function addressToken(s: string): string | null {
  const m = s.match(/\b(\d{2,6})\s+([a-z][a-z]+)\b/i)
  return m ? `${m[1]} ${m[2]}`.toLowerCase() : null
}

export function articleCoversEvent(event: LocalEvent, article: LocalArticle): boolean {
  const eventText = `${event.title} ${event.whatChanged ?? ''} ${event.summary ?? ''}`
  const artText = `${article.title} ${article.description ?? ''}`
  let signals = 0

  if (overlapCount(sigWords(event.title), sigWords(artText)) >= 2) signals++

  const eventDollars = dollarAmounts(eventText)
  const artDollars = dollarAmounts(artText)
  if (eventDollars.some(x => artDollars.some(y => Math.abs(x - y) <= 0.05 * x))) signals++

  const addr = addressToken(eventText)
  if (addr && artText.toLowerCase().includes(addr)) signals++

  return signals >= 2
}

export function detectLocalCoverage(
  event: LocalEvent,
  articles: LocalArticle[],
  opts: { windowDays?: number } = {}
): number {
  const windowMs = (opts.windowDays ?? 7) * 24 * 60 * 60 * 1000
  const t0 = new Date(event.firstSeenAt).getTime()
  const outlets = new Set<string>()
  for (const a of articles) {
    const at = new Date(a.publishedAt).getTime()
    if (Number.isNaN(at) || Math.abs(at - t0) > windowMs) continue
    if (articleCoversEvent(event, a)) outlets.add(a.outlet)
  }
  return outlets.size
}
