import { describe, expect, it } from 'vitest'
import { resolvedUpdateRow } from './resolution'

describe('resolvedUpdateRow', () => {
  it('builds a resolved event_update carrying the reason in new_value', () => {
    const row = resolvedUpdateRow('e1', 'feed_absent', 'No longer present in the source feed')
    expect(row).toEqual({
      event_id: 'e1',
      kind: 'resolved',
      text: 'No longer present in the source feed',
      new_value: { reason: 'feed_absent' },
    })
  })
  it('carries time_sweep', () => {
    expect(resolvedUpdateRow('e2', 'time_sweep', 'Aged out').new_value).toEqual({ reason: 'time_sweep' })
  })
})
