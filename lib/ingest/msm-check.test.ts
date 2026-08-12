import { describe, expect, it, vi, afterEach } from 'vitest'
import { checkMSMCoverage, MSM_OUTLET_COUNT, normalizeCoverageQuery, resetThrottleDetection } from './msm-check'

// Build a minimal Google-News-style RSS payload that "mentions" the given
// outlet domains (so the substring match in checkMSMCoverage fires).
function rss(domains: string[], items = 8): string {
  const entries = domains.map(d => `<item><link>https://${d}/x</link><source url="https://${d}">x</source></item>`).join('')
  const filler = Array.from({ length: Math.max(0, items - domains.length) }, () => '<item><link>https://example.com/x</link></item>').join('')
  return `<rss><channel>${entries}${filler}</channel></rss>`
}

// A healthy throttle canary (5 MSM outlets) so a thin story body doesn't trip the
// throttle path in tests that aren't about throttling.
const HEALTHY_CANARY = rss(['nytimes.com', 'cnn.com', 'bbc.com', 'apnews.com', 'reuters.com'])
const isCanary = (url: unknown) => String(url).includes('white%20house')

function mockFetch(body: string) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    text: async () => (isCanary(url) ? HEALTHY_CANARY : body),
  })))
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetThrottleDetection()
})

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

// --- Throttle detection + retry (CI-IP RSS rate-limiting) ---
describe('checkMSMCoverage throttle detection', () => {
  it('keeps a genuinely-low count when the canary is healthy (not throttled)', async () => {
    mockFetch(rss(['bbc.com'])) // story thin; healthy canary served for the probe
    const r = await checkMSMCoverage('an obscure story with little coverage')
    expect(r.throttled).toBeFalsy()
    expect(r.coveredBy.length).toBe(1)
  })

  it('flags throttled when even the canary comes back thin', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, text: async () => (isCanary(url) ? rss([]) : rss(['bbc.com'])) })))
    const p = checkMSMCoverage('an obscure local story about nothing widely covered')
    await vi.runAllTimersAsync()
    const r = await p
    expect(r.throttled).toBe(true)
    vi.useRealTimers()
  })

  it('recovers on retry when the throttle is transient', async () => {
    vi.useFakeTimers()
    let storyCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (isCanary(url)) return { ok: true, text: async () => rss([]) }
      storyCalls++
      const body = storyCalls <= 2 ? rss(['bbc.com']) : rss(['nytimes.com', 'cnn.com', 'bbc.com', 'apnews.com', 'reuters.com', 'npr.org'])
      return { ok: true, text: async () => body }
    }))
    const p = checkMSMCoverage('a story that recovers after backoff')
    await vi.runAllTimersAsync()
    const r = await p
    expect(r.throttled).toBe(false)
    expect(r.coveredBy.length).toBeGreaterThanOrEqual(5)
    vi.useRealTimers()
  })
})
