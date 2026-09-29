import { describe, expect, it } from 'vitest'
import { parseAgendaItems, agendaItemToCandidate } from './marin-agendas'

const now = new Date('2026-09-28T00:00:00Z')
const xml = `<rss><channel>
<item><title>Board of Supervisors Meeting 260930</title>
  <link>https://marin.granicus.com/AgendaViewer.php?view_id=33&clip_id=1</link>
  <guid>clip-1</guid><pubDate>Fri, 26 Sep 2026 00:00:00 GMT</pubDate></item>
<item><title>Board of Supervisors Meeting 260915</title>
  <link>https://marin.granicus.com/AgendaViewer.php?view_id=33&clip_id=0</link>
  <guid>clip-0</guid><pubDate>Mon, 08 Sep 2026 00:00:00 GMT</pubDate></item>
<item><title>No date here</title><link>https://x</link><guid>clip-x</guid></item>
</channel></rss>`

describe('Marin agendas ingestion', () => {
  it('keeps recent/upcoming meetings, drops past + undated', () => {
    const items = parseAgendaItems(xml, { now })
    expect(items.map(i => i.externalId)).toEqual(['clip-1']) // 260915 is past, undated dropped
    expect(items[0].geo?.precision).toBe('city')
    expect(items[0].title).toContain('260930')
  })
  it('candidate maps to government_action (held type) with dedupeKey', () => {
    const cand = agendaItemToCandidate(parseAgendaItems(xml, { now })[0])
    expect(cand.eventType).toBe('government_action')
    expect(cand.dedupeKey).toBe('marin-bos-agendas:clip-1')
    expect(cand.geo?.precision).toBe('city')
    expect(cand.startedAt).toBe('2026-09-30T00:00:00.000Z')
  })
})
