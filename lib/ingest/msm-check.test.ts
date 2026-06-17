import { describe, expect, it, vi, afterEach } from 'vitest'
import { checkMSMCoverage, MSM_OUTLET_COUNT } from './msm-check'

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
