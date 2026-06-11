import { describe, expect, it } from 'vitest'

import { getSourceTier } from './source-tier'

describe('source tier lookup', () => {
  it('classifies TRT World handles as state media', () => {
    expect(getSourceTier('trtworld', 'YouTube/TRT World', 'reported')).toEqual({
      tier: 8,
      sourceType: 'State Media',
    })
  })

  it('classifies TRT World YouTube sources as state media', () => {
    expect(getSourceTier(null, 'YouTube/TRT World', 'reported')).toEqual({
      tier: 8,
      sourceType: 'State Media',
    })
  })
})
