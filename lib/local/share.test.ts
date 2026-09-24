import { describe, expect, it } from 'vitest'
import { encodeShareToken, decodeShareToken } from './share'

describe('share token', () => {
  it('round-trips a location', () => {
    const loc = { lat: 38.1585, lng: -122.8905, label: 'Marshall, CA', radiusMiles: 8 }
    const token = encodeShareToken(loc)
    expect(token).not.toContain('=') // url-safe, unpadded
    expect(token).not.toMatch(/[+/]/)
    const back = decodeShareToken(token)
    expect(back).toEqual({ lat: 38.1585, lng: -122.8905, label: 'Marshall, CA', radiusMiles: 8 })
  })

  it('rejects garbage / out-of-range tokens', () => {
    expect(decodeShareToken('not-base64!!')).toBeNull()
    expect(decodeShareToken(encodeShareToken({ lat: 200, lng: 0, label: 'x', radiusMiles: 5 }))).toBeNull()
    expect(decodeShareToken(Buffer.from('{"la":1,"ln":2}').toString('base64url'))).toBeNull() // no label
  })

  it('defaults a bad radius to 10', () => {
    const t = encodeShareToken({ lat: 38, lng: -122, label: 'Somewhere', radiusMiles: 0 })
    expect(decodeShareToken(t)?.radiusMiles).toBe(10)
  })
})
