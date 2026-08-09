import { describe, expect, it } from 'vitest'
import { isSatireSource, SATIRE_HANDLES } from './satire-sources'

describe('isSatireSource', () => {
  it('matches by journalist handle (case-insensitive)', () => {
    expect(isSatireSource('joshjohnsoncomedy', null)).toBe(true)
    expect(isSatireSource('LateNightSeth', null)).toBe(true)
    expect(isSatireSource('TheBabylonBee', null)).toBe(true)
  })

  it('matches by source name (search-ingested, no handle)', () => {
    expect(isSatireSource(null, 'YouTube/Saturday Night Live')).toBe(true)
    expect(isSatireSource(null, 'YouTube/Late Night with Seth Meyers')).toBe(true)
  })

  it('does not match a straight-news source', () => {
    expect(isSatireSource('cbsnews', 'YouTube/CBS News')).toBe(false)
    expect(isSatireSource(null, null)).toBe(false)
  })

  it('keeps both new comedy channels in the handle set', () => {
    expect(SATIRE_HANDLES.has('latenightseth')).toBe(true)
    expect(SATIRE_HANDLES.has('thebabylonbee')).toBe(true)
  })
})
