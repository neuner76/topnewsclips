import { describe, expect, it } from 'vitest'
import { classifyLifecycle } from './lifecycle'

const now = new Date('2026-09-28T12:00:00Z')
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

describe('classifyLifecycle (§7.4 time-based)', () => {
  it('auto-resolves an active event stale beyond auto_resolve_after_minutes', () => {
    const e = { lifecycleState: 'active', latestUpdateAt: minsAgo(300), resolvedAt: null }
    expect(classifyLifecycle(e, { autoResolveAfterMinutes: 240, archiveAfterDays: 30 }, now)).toBe('resolve')
  })
  it('keeps a fresh active event within the window', () => {
    const e = { lifecycleState: 'active', latestUpdateAt: minsAgo(60), resolvedAt: null }
    expect(classifyLifecycle(e, { autoResolveAfterMinutes: 240, archiveAfterDays: 30 }, now)).toBe('keep')
  })
  it('backstop: resolves an active event older than archive_after_days even w/o auto-resolve', () => {
    const e = { lifecycleState: 'active', latestUpdateAt: daysAgo(31), resolvedAt: null }
    expect(classifyLifecycle(e, { autoResolveAfterMinutes: null, archiveAfterDays: 30 }, now)).toBe('resolve')
  })
  it('keeps an active event within the archive window when no auto-resolve', () => {
    const e = { lifecycleState: 'active', latestUpdateAt: daysAgo(10), resolvedAt: null }
    expect(classifyLifecycle(e, { autoResolveAfterMinutes: null, archiveAfterDays: 30 }, now)).toBe('keep')
  })
  it('archives a resolved event past archive_after_days', () => {
    const e = { lifecycleState: 'resolved', latestUpdateAt: daysAgo(40), resolvedAt: daysAgo(31) }
    expect(classifyLifecycle(e, { archiveAfterDays: 30 }, now)).toBe('archive')
  })
  it('keeps a recently-resolved event', () => {
    const e = { lifecycleState: 'resolved', latestUpdateAt: daysAgo(5), resolvedAt: daysAgo(5) }
    expect(classifyLifecycle(e, { archiveAfterDays: 30 }, now)).toBe('keep')
  })
  it('keeps rows with unparseable/missing timestamps (never destructive on bad data)', () => {
    expect(classifyLifecycle({ lifecycleState: 'active', latestUpdateAt: null, resolvedAt: null }, { archiveAfterDays: 30 }, now)).toBe('keep')
    expect(classifyLifecycle({ lifecycleState: 'resolved', latestUpdateAt: null, resolvedAt: null }, { archiveAfterDays: 30 }, now)).toBe('keep')
    expect(classifyLifecycle({ lifecycleState: 'archived', latestUpdateAt: daysAgo(99), resolvedAt: daysAgo(99) }, { archiveAfterDays: 30 }, now)).toBe('keep')
  })
})
