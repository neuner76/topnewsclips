import { describe, expect, it } from 'vitest'
import { candidatePriority, orderCandidatesByPriority } from './pipeline'

// Processing slots are scarce (fetch outruns process ~122 vs ~78/day), and the
// old selection was pure newest-first — so a foreign broadcaster's Nth clip of
// the day crowded out US-domestic newsroom clips (CNBC "$26B in the U.S.", CBS
// "unemployment near 25%") that are exactly the Need-To-Know material. Priority
// spends the scarce slots on the starved high-value pool instead of the newest.
describe('candidatePriority', () => {
  it('ranks satire highest (reserved slot so comedy is never crowded out)', () => {
    expect(candidatePriority({ journalist_username: 'joshjohnsoncomedy', source: 'YouTube/Josh Johnson' })).toBe(3)
    expect(candidatePriority({ journalist_username: 'saturdaynightlive', source: null })).toBe(3)
  })

  it('ranks US-domestic / non-global newsrooms above global broadcasters', () => {
    expect(candidatePriority({ journalist_username: 'cnbc', source: 'YouTube/CNBC' })).toBe(2)
    expect(candidatePriority({ journalist_username: 'cbsnews', source: 'YouTube/CBS News' })).toBe(2)
  })

  it('ranks global broadcasters lowest (they dominate supply and feed the world sections)', () => {
    expect(candidatePriority({ journalist_username: 'aljazeeraenglish', source: null })).toBe(1)
    expect(candidatePriority({ journalist_username: null, source: 'YouTube/DW News' })).toBe(1)
  })

  it('is safe on empty input (treated as non-global, not satire)', () => {
    expect(candidatePriority({ journalist_username: null, source: null })).toBe(2)
    expect(candidatePriority({})).toBe(2)
  })
})

describe('orderCandidatesByPriority', () => {
  const mk = (u: string | null, fetched: string, source: string | null = null) =>
    ({ journalist_username: u, source, fetched_at: fetched, title: u ?? 'x' })

  it('orders satire, then US-domestic, then global broadcaster', () => {
    const global = mk('dwnews', '2026-08-31T12:00:00Z')
    const domestic = mk('cnbc', '2026-08-31T11:00:00Z')
    const satire = mk('joshjohnsoncomedy', '2026-08-31T10:00:00Z')
    const out = orderCandidatesByPriority([global, domestic, satire])
    expect(out.map(c => c.journalist_username)).toEqual(['joshjohnsoncomedy', 'cnbc', 'dwnews'])
  })

  it('breaks ties within a priority tier by recency (newest first)', () => {
    const older = mk('cbsnews', '2026-08-31T09:00:00Z')
    const newer = mk('cnbc', '2026-08-31T15:00:00Z')
    const out = orderCandidatesByPriority([older, newer])
    expect(out.map(c => c.journalist_username)).toEqual(['cnbc', 'cbsnews'])
  })

  it('does not mutate the input array', () => {
    const input = [mk('dwnews', '2026-08-31T12:00:00Z'), mk('cnbc', '2026-08-31T11:00:00Z')]
    const snapshot = input.map(c => c.journalist_username)
    orderCandidatesByPriority(input)
    expect(input.map(c => c.journalist_username)).toEqual(snapshot)
  })
})
