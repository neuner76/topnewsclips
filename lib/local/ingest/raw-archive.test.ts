import { describe, expect, it } from 'vitest'
import { serializeRawBody, storageKey } from './raw-archive'

describe('serializeRawBody', () => {
  it('stringifies objects and passes strings through', () => {
    expect(serializeRawBody({ a: 1 })).toBe('{"a":1}')
    expect(serializeRawBody('<xml/>')).toBe('<xml/>')
  })
})

describe('storageKey (§5.3)', () => {
  it('keys by source_slug/YYYY/MM/DD/<fetched_at>-<hash> (UTC)', () => {
    const key = storageKey('nws-alerts-marin', '2026-09-25T04:07:00.000Z', 'abc123')
    expect(key).toBe('nws-alerts-marin/2026/09/25/2026-09-25T04:07:00.000Z-abc123')
  })
})
