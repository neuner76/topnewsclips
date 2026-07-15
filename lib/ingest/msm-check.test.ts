import { describe, expect, it, vi, afterEach } from 'vitest'
import { checkMSMCoverage, MSM_OUTLET_COUNT, normalizeCoverageQuery } from './msm-check'

// Build a minimal Google-News-style RSS payload that "mentions" the given
// outlet domains (so the substring match in checkMSMCoverage fires).
function rss(domains: string[], items = 8): string {
  const entries = domains.map(d => `<item><link>https://${d}/x</link><source url="https://${d}">x</source></item>`).join('')
  const filler = Array.from({ length: Math.max(0, items - domains.length) }, () => '<item><link>https://example.com/x</link></item>').join('')
  return `<rss><channel>${entries}${filler}</channel></rss>`
}

function mockFetch(body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => body })))
}

afterEach(() => vi.unstubAllGlobals())

describe('checkMSMCoverage denominator integrity (3.4)', () => {
  it('exposes a stable distinct-outlet count of 15', () => {
    expect(MSM_OUTLET_COUNT).toBe(15)
  })

  it('keeps covered + notCovered == MSM_OUTLET_COUNT when BBC DOES cover', async () => {
    mockFetch(rss(['bbc.com', 'apnews.com', 'reuters.com']))
    const r = await checkMSMCoverage('some story')
    expect(r.coveredBy.length + r.notCoveredBy.length).toBe(MSM_OUTLET_COUNT)
  })

  it('keeps covered + notCovered == MSM_OUTLET_COUNT when BBC does NOT cover (the old of-15 flip)', async () => {
    // No BBC domain present — previously this inflated the not-covered side to 15
    // while a BBC-covered story read 14. Now both are a constant 15.
    mockFetch(rss(['apnews.com', 'reuters.com', 'cnn.com']))
    const r = await checkMSMCoverage('some story')
    expect(r.coveredBy.length + r.notCoveredBy.length).toBe(MSM_OUTLET_COUNT)
  })

  it('counts BBC once even when both .com and .co.uk appear', async () => {
    mockFetch(rss(['bbc.com', 'bbc.co.uk']))
    const r = await checkMSMCoverage('some story')
    expect(r.coveredBy.filter(d => d.startsWith('bbc')).length).toBe(1)
    expect(r.coveredBy.length + r.notCoveredBy.length).toBe(MSM_OUTLET_COUNT)
  })
})

// A long, specific story title is a poor news-search query — outlets headline the
// same event with different words, so the exact phrasing matches few of them
// (e.g. "US military strikes Iranian targets near Strait of Hormuz amid escalating
// naval confrontation" matched 2 of 15 outlets; the trimmed core matched 10-12).
// normalizeCoverageQuery produces the shorter core; the caller unions its result
// with the full-title result, so a worse normalization can only ever be neutral.
describe('normalizeCoverageQuery', () => {
  it('drops a trailing subordinate clause at a connector', () => {
    expect(normalizeCoverageQuery('US military strikes Iranian targets near Strait of Hormuz amid escalating naval confrontation'))
      .toBe('US military strikes Iranian targets near Strait of Hormuz')
  })

  it('cuts at a comma clause', () => {
    expect(normalizeCoverageQuery('Israel schedules October 2026 election, Netanyahu coalition collapses'))
      .toBe('Israel schedules October 2026 election')
  })

  it('strips a leading article', () => {
    expect(normalizeCoverageQuery('The Senate passes the housing bill')).toBe('Senate passes the housing bill')
  })

  it('leaves a short canonical title unchanged', () => {
    expect(normalizeCoverageQuery('Sen. Lindsey Graham dies at 71')).toBe('Sen. Lindsey Graham dies at 71')
  })

  it('caps an over-long title with no connector to a word budget', () => {
    const out = normalizeCoverageQuery('Congress enacted the 21st Century ROAD to Housing Act largest housing legislation in decades')
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(12)
    expect(out.startsWith('Congress enacted')).toBe(true)
  })

  it('handles empty / one-word input', () => {
    expect(normalizeCoverageQuery('  ')).toBe('')
    expect(normalizeCoverageQuery('Breaking')).toBe('Breaking')
  })
})
