import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseGranicusAgendas } from './marin-granicus'

const fixture = fs.readFileSync(path.join('fixtures', 'sources', 'marin-granicus', 'sample.xml'), 'utf8')

const rss = (items: string) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`
const item = (title: string, link: string, pubDate = 'Wed, 09 Sep 2026 01:22:22 -0700') =>
  `<item><guid>${title}</guid><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>`

describe('parseGranicusAgendas', () => {
  it('parses the live fixture into government_meeting events with a direct agenda link', () => {
    const out = parseGranicusAgendas(fixture, { now: new Date('2026-09-01T00:00:00Z') })
    expect(out.length).toBeGreaterThan(0)
    expect(out.every(e => e.eventType === 'government_meeting')).toBe(true)
    expect(out.every(e => /AgendaViewer\.php/.test(e.sources[0].url ?? ''))).toBe(true)
    expect(out.every(e => e.sources[0].label.includes('Board of Supervisors'))).toBe(true)
  })

  it('parses the meeting date from the YYMMDD code in the title', () => {
    const out = parseGranicusAgendas(
      rss(item('BOS Meeting 260915 - Sep 15, 2026', 'https://marin.granicus.com/AgendaViewer.php?view_id=33&event_id=4269')),
      { now: new Date('2026-09-10T00:00:00Z') },
    )
    expect(out).toHaveLength(1)
    expect(out[0].firstSeenAt.slice(0, 10)).toBe('2026-09-15')
  })

  it('keeps upcoming/recent meetings and sorts soonest first', () => {
    const items =
      item('BOS Meeting 260901 - Sep 01, 2026', 'https://marin.granicus.com/AgendaViewer.php?a=1') + // past (dropped)
      item('BOS Meeting 260922 - Sep 22, 2026', 'https://marin.granicus.com/AgendaViewer.php?a=2') +
      item('BOS Meeting 260915 - Sep 15, 2026', 'https://marin.granicus.com/AgendaViewer.php?a=3')
    const out = parseGranicusAgendas(rss(items), { now: new Date('2026-09-10T00:00:00Z') })
    expect(out.map(e => e.firstSeenAt.slice(0, 10))).toEqual(['2026-09-15', '2026-09-22'])
  })

  it('respects the limit', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`BOS Meeting 2609${20 + i} - Sep ${20 + i}, 2026`, `https://x/AgendaViewer.php?a=${i}`)).join('')
    expect(parseGranicusAgendas(rss(many), { now: new Date('2026-09-10T00:00:00Z'), limit: 3 })).toHaveLength(3)
  })
})
