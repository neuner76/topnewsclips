import { describe, it, expect } from 'vitest'
import { needsCorroborationHold } from './pipeline'

describe('needsCorroborationHold', () => {
  it('holds Tier 8-10 sources with zero outlet coverage', () => {
    expect(needsCorroborationHold(8, 0)).toBe(true)
    expect(needsCorroborationHold(9, 0)).toBe(true)
    expect(needsCorroborationHold(10, 0)).toBe(true)
  })

  it('holds unrecognized (null-tier) sources with zero outlet coverage', () => {
    expect(needsCorroborationHold(null, 0)).toBe(true)
  })

  it('does not hold Tier 8-10 sources once any outlet coverage exists', () => {
    expect(needsCorroborationHold(8, 1)).toBe(false)
    expect(needsCorroborationHold(9, 2)).toBe(false)
    expect(needsCorroborationHold(10, 5)).toBe(false)
  })

  it('never holds Tier 1-7 sources, even with zero coverage', () => {
    expect(needsCorroborationHold(1, 0)).toBe(false)
    expect(needsCorroborationHold(3, 0)).toBe(false)
    expect(needsCorroborationHold(6, 0)).toBe(false)
    expect(needsCorroborationHold(7, 0)).toBe(false)
  })
})
