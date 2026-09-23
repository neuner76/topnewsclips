import { describe, expect, it } from 'vitest'
import { isBusinessCandidate } from './business-sources'

describe('isBusinessCandidate', () => {
  it('matches daily markets newsrooms by handle', () => {
    expect(isBusinessCandidate('cnbc', 'YouTube/CNBC')).toBe(true)
    expect(isBusinessCandidate('markets', 'YouTube/Bloomberg Television')).toBe(true)
    expect(isBusinessCandidate('YahooFinance', null)).toBe(true)
  })

  it('matches by source name when the handle is absent (search-sourced clips)', () => {
    expect(isBusinessCandidate(null, 'YouTube/Bloomberg Markets and Finance')).toBe(true)
  })

  it('matches a markets-topic title from a general newsroom', () => {
    expect(isBusinessCandidate('cbsnews', null, 'Federal Reserve holds interest rates steady')).toBe(true)
    expect(isBusinessCandidate('nbcnews', null, 'Stock market plunges after earnings')).toBe(true)
  })

  it('does NOT match politics stories that merely mention money', () => {
    expect(isBusinessCandidate('cnn', null, 'Congress approves $2 billion in aid')).toBe(false)
    expect(isBusinessCandidate('ForbesBreakingNews', 'YouTube/Forbes Breaking News', 'Trump addresses UN')).toBe(false)
  })

  it('is safe on empty input', () => {
    expect(isBusinessCandidate()).toBe(false)
    expect(isBusinessCandidate(null, null, null)).toBe(false)
  })
})
