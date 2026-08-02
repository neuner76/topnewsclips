import { describe, expect, it } from 'vitest'
import { isGlobalBroadcaster, channelDailyCap } from './pipeline'

// Global broadcasters upload far more clips/day than US/domestic sources, so
// they get a tighter per-channel cap (2) than everyone else (5) to stop a
// handful of foreign channels from crowding out US-domestic supply.
describe('isGlobalBroadcaster / channelDailyCap', () => {
  it('detects a global broadcaster by journalist handle', () => {
    expect(isGlobalBroadcaster('aljazeeraenglish', null)).toBe(true)
    expect(isGlobalBroadcaster('trtworld', null)).toBe(true)
    expect(channelDailyCap('dwnews', null)).toBe(2)
  })

  it('detects a global broadcaster by source name (search-ingested, no handle)', () => {
    expect(isGlobalBroadcaster(null, 'YouTube/France 24 English')).toBe(true)
    expect(isGlobalBroadcaster(null, 'YouTube/Al Jazeera English')).toBe(true)
    expect(channelDailyCap(null, 'YouTube/WION')).toBe(2)
  })

  it('treats US/domestic and institutional channels as standard-cap', () => {
    expect(isGlobalBroadcaster('cbsnews', 'YouTube/CBS News')).toBe(false)
    expect(isGlobalBroadcaster('pbsnewshour', null)).toBe(false)
    expect(isGlobalBroadcaster('cspan', null)).toBe(false)
    expect(channelDailyCap('cbsnews', 'YouTube/CBS News')).toBe(5)
  })

  it('is safe on empty input', () => {
    expect(isGlobalBroadcaster(null, null)).toBe(false)
    expect(isGlobalBroadcaster(undefined, undefined)).toBe(false)
    expect(channelDailyCap(null, null)).toBe(5)
  })
})
