import { describe, expect, it } from 'vitest'
import { candidatePriority, orderCandidatesByPriority } from './pipeline'

// Processing slots are scarce (fetch outruns process ~122 vs ~20/day), and the
// selection is priority + recency. Priority spends the scarce slots on the
// starved high-value pool instead of the newest. Tiers (high→low):
//   4 satire        — strictly reserved so comedy is never crowded out
//   3 business      — reserved lane so markets clips survive the politics deluge
//   2 US-domestic   — general US newsrooms
//   1 global bcast  — already dominate supply, feed the world sections
describe('candidatePriority', () => {
  it('ranks satire highest (strictly reserved slot)', () => {
    expect(candidatePriority({ journalist_username: 'joshjohnsoncomedy', source: 'YouTube/Josh Johnson' })).toBe(4)
    expect(candidatePriority({ journalist_username: 'saturdaynightlive', source: null })).toBe(4)
  })

  it('ranks business sources in their own reserved lane above general US newsrooms', () => {
    expect(candidatePriority({ journalist_username: 'cnbc', source: 'YouTube/CNBC' })).toBe(3)
    expect(candidatePriority({ journalist_username: 'markets', source: 'YouTube/Bloomberg Television' })).toBe(3)
    expect(candidatePriority({ journalist_username: 'YahooFinance', source: null })).toBe(3)
  })

  it('ranks a markets-topic clip from a general source into the business lane (by title)', () => {
    expect(candidatePriority({ journalist_username: 'cbsnews', source: null, title: 'Federal Reserve holds interest rates steady' })).toBe(3)
    expect(candidatePriority({ journalist_username: 'nbcnews', source: null, title: 'Stock market plunges as earnings disappoint' })).toBe(3)
  })

  it('ranks general US-domestic newsrooms above global broadcasters', () => {
    expect(candidatePriority({ journalist_username: 'cbsnews', source: 'YouTube/CBS News', title: 'Wildfire evacuations expand' })).toBe(2)
  })

  it('ranks global broadcasters lowest', () => {
    expect(candidatePriority({ journalist_username: 'aljazeeraenglish', source: null })).toBe(1)
    expect(candidatePriority({ journalist_username: null, source: 'YouTube/DW News' })).toBe(1)
  })

  it('is safe on empty input (treated as non-global, not satire/business)', () => {
    expect(candidatePriority({ journalist_username: null, source: null })).toBe(2)
    expect(candidatePriority({})).toBe(2)
  })
})

describe('orderCandidatesByPriority', () => {
  const mk = (u: string | null, fetched: string, source: string | null = null, title: string | null = null) =>
    ({ journalist_username: u, source, fetched_at: fetched, title: title ?? u ?? 'x' })

  it('orders satire, then business, then US-domestic, then global broadcaster', () => {
    const global = mk('dwnews', '2026-08-31T12:00:00Z')
    const domestic = mk('cbsnews', '2026-08-31T11:00:00Z', null, 'Wildfire evacuations')
    const business = mk('cnbc', '2026-08-31T10:30:00Z')
    const satire = mk('joshjohnsoncomedy', '2026-08-31T10:00:00Z')
    const out = orderCandidatesByPriority([global, domestic, business, satire])
    expect(out.map(c => c.journalist_username)).toEqual(['joshjohnsoncomedy', 'cnbc', 'cbsnews', 'dwnews'])
  })

  it('breaks ties within a priority tier by recency (newest first)', () => {
    const older = mk('cbsnews', '2026-08-31T09:00:00Z', null, 'City council vote')
    const newer = mk('nbcnews', '2026-08-31T15:00:00Z', null, 'Storm damage assessed')
    const out = orderCandidatesByPriority([older, newer])
    expect(out.map(c => c.journalist_username)).toEqual(['nbcnews', 'cbsnews'])
  })

  it('does not mutate the input array', () => {
    const input = [mk('dwnews', '2026-08-31T12:00:00Z'), mk('cnbc', '2026-08-31T11:00:00Z')]
    const snapshot = input.map(c => c.journalist_username)
    orderCandidatesByPriority(input)
    expect(input.map(c => c.journalist_username)).toEqual(snapshot)
  })
})
