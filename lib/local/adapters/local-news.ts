// Local journalism (Build C) — RSS from Marin/regional outlets. Feeds two things:
// the "Local Reporting" section, and the coverage detector (lib/local/coverage.ts)
// that decides whether a public record is a Local Blindspot. Check the national
// source registry before adding an outlet here; reference, don't duplicate.
import type { LocalEvent } from '../types'

export interface LocalArticle {
  outlet: string
  title: string
  description?: string
  url?: string
  publishedAt: string // ISO
}

const OUTLETS: Array<{ outlet: string; feed: string }> = [
  { outlet: 'Point Reyes Light', feed: 'https://www.ptreyeslight.com/feed/' },
  { outlet: 'KQED', feed: 'https://ww2.kqed.org/news/feed/' },
]

const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}
function decode(s: string): string {
  return stripCdata(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export function parseLocalNewsRss(xml: string, outlet: string): LocalArticle[] {
  const out: LocalArticle[] = []
  for (const block of xml.split('<item>').slice(1)) {
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const url = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const description = decode(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '').slice(0, 500)
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').trim()
    if (!title) continue
    const t = Date.parse(pub)
    out.push({ outlet, title, description: description || undefined, url: url || undefined, publishedAt: Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString() })
  }
  return out
}

export function articleToLocalEvent(a: LocalArticle): LocalEvent {
  return {
    id: `local-news-${a.url ?? a.title}`,
    title: a.title,
    eventType: 'local_news',
    status: 'new',
    firstSeenAt: a.publishedAt,
    latestUpdateAt: a.publishedAt,
    geo: { counties: ['Marin County'] },
    consequenceScore: 0.4,
    confidence: 'medium',
    sources: [{ type: 'local_news', label: a.outlet, url: a.url, observedAt: a.publishedAt, status: 'confirmed' }],
    summary: a.description,
  }
}

export async function fetchLocalNews(): Promise<LocalArticle[]> {
  const all = await Promise.all(OUTLETS.map(async ({ outlet, feed }) => {
    try {
      const res = await fetch(feed, { headers: { 'User-Agent': UA } })
      if (!res.ok) return []
      return parseLocalNewsRss(await res.text(), outlet)
    } catch {
      return []
    }
  }))
  return all.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}
