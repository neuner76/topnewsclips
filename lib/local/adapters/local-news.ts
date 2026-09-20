// Local journalism (Build C) — RSS from Marin/regional outlets. Feeds two things:
// the "Local Reporting" section (DISPLAY_OUTLETS, direct feeds with real links),
// and the coverage detector (lib/local/coverage.ts) that decides whether a public
// record is a Local Blindspot (COVERAGE set = display + Marin IJ via Google News).
//
// Why the split: the Marin Independent Journal is the county's daily and the outlet
// most likely to cover county government, but its site is behind bot protection and
// returns 403 to any server fetch (and its robots.txt aside, it does not want
// programmatic access). Google News publishes a public RSS feed we CAN read; we use
// it (site:marinij.com) to check whether the IJ covered a record. Those links are
// news.google.com redirects to a paywall, so Marin IJ is coverage-only, never shown
// as clickable Local Reporting. Check the national source registry before adding an
// outlet; reference, don't duplicate.
import type { LocalEvent } from '../types'

export interface LocalArticle {
  outlet: string
  title: string
  description?: string
  url?: string
  publishedAt: string // ISO
}

// Directly-fetchable Marin/regional outlets shown in Local Reporting.
const DISPLAY_OUTLETS: Array<{ outlet: string; feed: string }> = [
  { outlet: 'Point Reyes Light', feed: 'https://www.ptreyeslight.com/feed/' },
  { outlet: 'Pacific Sun', feed: 'https://pacificsun.com/feed/' },
  { outlet: 'KQED', feed: 'https://ww2.kqed.org/news/feed/' },
]

// Coverage-only: the county daily, reachable only via Google News' public RSS.
const GOOGLE_NEWS_MARIN_IJ =
  'https://news.google.com/rss/search?q=site:marinij.com%20when:14d&hl=en-US&gl=US&ceid=US:en'

// Human-readable names of the outlets the coverage detector actually checks —
// used to keep the Blindspot copy honest about what was and wasn't searched.
export const COVERAGE_OUTLET_NAMES = ['Marin IJ', 'Pacific Sun', 'Point Reyes Light', 'KQED']

const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'

// Outlets that are inherently Marin-local — their stories are local by default,
// even when the copy doesn't literally say "Marin".
export const LOCAL_MARIN_OUTLETS = new Set(['Point Reyes Light', 'Pacific Sun', 'Marin IJ'])

// Marin / Novato place terms used to keep regional outlets (e.g. KQED) honest:
// a KQED story only counts as Local Reporting if it names one of these.
export const MARIN_LOCAL_TERMS = [
  'marin', 'novato', 'san rafael', 'mill valley', 'sausalito', 'tiburon', 'belvedere',
  'corte madera', 'larkspur', 'ross', 'kentfield', 'greenbrae', 'san anselmo', 'fairfax',
  'point reyes', 'tomales', 'west marin', 'bolinas', 'stinson beach', 'nicasio', 'inverness',
  'marin city', 'san geronimo', 'lagunitas', 'olema', 'dillon beach', 'muir beach',
]
const MARIN_TERM_RE = new RegExp(`\\b(${MARIN_LOCAL_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')

// True if the text names a Marin/Novato place.
export function mentionsMarinLocal(text: string): boolean {
  return MARIN_TERM_RE.test(text)
}

// Local Reporting gate: inherently-local outlets always pass; regional outlets
// (KQED) pass only when the headline/summary names a Marin place.
export function isLocalToMarin(a: LocalArticle): boolean {
  if (LOCAL_MARIN_OUTLETS.has(a.outlet)) return true
  return mentionsMarinLocal(`${a.title} ${a.description ?? ''}`)
}

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

// Google News RSS wraps each headline as "Headline - Source Name" and links
// through a news.google.com redirect. Same item shape otherwise; we strip the
// trailing " - Source" so titles read cleanly for coverage matching.
export function parseGoogleNewsRss(xml: string, outlet: string): LocalArticle[] {
  return parseLocalNewsRss(xml, outlet).map(a => ({
    ...a,
    title: a.title.replace(/\s+-\s+[^-]+$/, '').trim() || a.title,
  }))
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

async function fetchRss(feed: string, outlet: string, parse: (xml: string, o: string) => LocalArticle[]): Promise<LocalArticle[]> {
  try {
    const res = await fetch(feed, { headers: { 'User-Agent': UA } })
    if (!res.ok) return []
    return parse(await res.text(), outlet)
  } catch {
    return []
  }
}

// Local Reporting section: directly-fetchable outlets with real, clickable links.
export async function fetchLocalNews(): Promise<LocalArticle[]> {
  const all = await Promise.all(DISPLAY_OUTLETS.map(({ outlet, feed }) => fetchRss(feed, outlet, parseLocalNewsRss)))
  return all.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

// Coverage detection (Blindspot): display outlets PLUS the Marin IJ via Google
// News, so "no local coverage" reflects the county daily too — not just the two
// weeklies. Not for display (Marin IJ links are paywalled Google redirects).
export async function fetchCoverageArticles(): Promise<LocalArticle[]> {
  const [display, ij] = await Promise.all([
    fetchLocalNews(),
    fetchRss(GOOGLE_NEWS_MARIN_IJ, 'Marin IJ', parseGoogleNewsRss),
  ])
  return [...display, ...ij].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}
