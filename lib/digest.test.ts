import { describe, expect, it } from 'vitest'

import { fallbackSectionTitle } from './digest'

describe('digest title fallbacks', () => {
  it('does not truncate Need To Know replacement titles mid-word', () => {
    expect(fallbackSectionTitle(
      'ProPublica investigation tracks counterterrorism strategy shift under Trump administration official'
    )).toBe(
      'ProPublica investigation tracks counterterrorism strategy shift under Trump administration official'
    )
  })
})
