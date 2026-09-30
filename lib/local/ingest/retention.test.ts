import { describe, expect, it } from 'vitest'
import { retentionCutoff } from './retention'

describe('retentionCutoff', () => {
  it('subtracts whole days in UTC', () => {
    expect(retentionCutoff(new Date('2026-09-30T12:00:00Z'), 7)).toBe('2026-09-23T12:00:00.000Z')
  })
  it('days=0 returns the same instant', () => {
    expect(retentionCutoff(new Date('2026-09-30T12:00:00Z'), 0)).toBe('2026-09-30T12:00:00.000Z')
  })
  it('is exact across a DST boundary (UTC arithmetic)', () => {
    expect(retentionCutoff(new Date('2026-11-10T12:00:00Z'), 7)).toBe('2026-11-03T12:00:00.000Z')
  })
})
