import { describe, expect, it } from 'vitest'
import { selectResolvableEventIds, type ActiveEventRef } from './resolve'
import { nwsAlertsAdapter } from './adapters/nws-alerts'
import { bay511EventsAdapter } from './adapters/bay511-events'
import { caltransLcsAdapter } from './adapters/caltrans-lcs'
import { calfireIncidentsAdapter } from './adapters/calfire-incidents'
import { marinPermitsAdapter } from './adapters/marin-permits'
import { marinAgendasAdapter } from './adapters/marin-agendas'

describe('selectResolvableEventIds (§7.4)', () => {
  const active: ActiveEventRef[] = [
    { id: 'a', dedupe_key: 'nws-alerts-marin:1' },
    { id: 'b', dedupe_key: 'nws-alerts-marin:2' },
    { id: 'c', dedupe_key: null }, // no key — never absence-resolved
  ]
  it('resolves events whose key is absent from the latest fetch', () => {
    const seen = new Set(['nws-alerts-marin:1']) // 2 is gone
    expect(selectResolvableEventIds(active, seen)).toEqual(['b'])
  })
  it('resolves nothing when all keys still present', () => {
    expect(selectResolvableEventIds(active, new Set(['nws-alerts-marin:1', 'nws-alerts-marin:2']))).toEqual([])
  })
  it('resolves all keyed events when the feed is empty', () => {
    expect(selectResolvableEventIds(active, new Set()).sort()).toEqual(['a', 'b'])
  })
})

describe('resolvesByAbsence flags', () => {
  it('current-state feeds opt in', () => {
    for (const a of [nwsAlertsAdapter, bay511EventsAdapter, caltransLcsAdapter, calfireIncidentsAdapter])
      expect(a.resolvesByAbsence).toBe(true)
  })
  it('event-log sources do not', () => {
    expect(marinPermitsAdapter.resolvesByAbsence).toBeFalsy()
    expect(marinAgendasAdapter.resolvesByAbsence).toBeFalsy()
  })
})
