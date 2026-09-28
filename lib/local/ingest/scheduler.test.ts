import { describe, expect, it } from 'vitest'
import { selectDueSources, MIN_INTERVAL_SECONDS } from './scheduler'

const now = new Date('2026-09-25T12:00:00Z')
const ago = (sec: number) => new Date(now.getTime() - sec * 1000).toISOString()
const src = (o: Partial<Parameters<typeof selectDueSources>[0][number]>) =>
  ({ slug: 's', active: true, crawl_interval_seconds: 600, last_success_at: null, ...o })

describe('selectDueSources', () => {
  it('runs a never-run active source', () => {
    expect(selectDueSources([src({ last_success_at: null })], now)).toHaveLength(1)
  })
  it('runs when the interval has elapsed, not before', () => {
    expect(selectDueSources([src({ crawl_interval_seconds: 600, last_success_at: ago(700) })], now)).toHaveLength(1)
    expect(selectDueSources([src({ crawl_interval_seconds: 600, last_success_at: ago(500) })], now)).toHaveLength(0)
  })
  it('skips inactive sources', () => {
    expect(selectDueSources([src({ active: false, last_success_at: null })], now)).toHaveLength(0)
  })
  it('enforces the 5-minute floor even if a source asks for less', () => {
    // config 60s, but last run 200s ago -> not due (floor is 300s)
    expect(selectDueSources([src({ crawl_interval_seconds: 60, last_success_at: ago(200) })], now)).toHaveLength(0)
    expect(selectDueSources([src({ crawl_interval_seconds: 60, last_success_at: ago(MIN_INTERVAL_SECONDS + 1) })], now)).toHaveLength(1)
  })
})
