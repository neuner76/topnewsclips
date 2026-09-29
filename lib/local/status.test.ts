import { describe, expect, it } from 'vitest'
import { summarizeSource, type SourceStatusRow } from './status'

const base: SourceStatusRow = {
  slug: 'nws-alerts-marin', name: 'NWS alerts', active: true,
  crawl_interval_seconds: 300, last_success_at: '2026-09-28T12:00:00Z',
  last_error: null, last_error_at: null, consecutive_failures: 0,
}
const now = new Date('2026-09-28T12:10:00Z') // 10 min after last success

describe('summarizeSource', () => {
  it('ok when it has an adapter and no failures', () => {
    const v = summarizeSource(base, true, now)
    expect(v.health).toBe('ok')
    expect(v.dueNow).toBe(true) // 10 min > 300s interval
  })
  it('no_adapter when unregistered (regardless of health)', () => {
    expect(summarizeSource(base, false, now).health).toBe('no_adapter')
    expect(summarizeSource(base, false, now).dueNow).toBe(false)
  })
  it('failing when consecutive_failures > 0', () => {
    expect(summarizeSource({ ...base, consecutive_failures: 3, last_error: 'HTTP 500' }, true, now).health).toBe('failing')
  })
  it('idle when never run', () => {
    expect(summarizeSource({ ...base, last_success_at: null }, true, now).health).toBe('idle')
    expect(summarizeSource({ ...base, last_success_at: null }, true, now).dueNow).toBe(true) // never run = due
  })
  it('enforces the 300s interval floor', () => {
    expect(summarizeSource({ ...base, crawl_interval_seconds: 60 }, true, now).intervalSeconds).toBe(300)
  })
  it('not due when within the interval', () => {
    const soon = new Date('2026-09-28T12:02:00Z') // 2 min after last success < 300s
    expect(summarizeSource(base, true, soon).dueNow).toBe(false)
  })
})
