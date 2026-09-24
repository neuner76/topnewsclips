import { describe, expect, it } from 'vitest'
import { MARIN_PLACES, MARIN_ZIP_TO_SLUG, findMarinPlace, findMarinPlaceByZip, resolveMarinPlace } from './marin-places'
import { encodeShareToken, decodeShareToken } from './share'

describe('MARIN_PLACES', () => {
  it('has unique slugs and valid Marin-range coordinates', () => {
    const slugs = new Set(MARIN_PLACES.map(p => p.slug))
    expect(slugs.size).toBe(MARIN_PLACES.length)
    for (const p of MARIN_PLACES) {
      expect(p.lat).toBeGreaterThan(37.7)
      expect(p.lat).toBeLessThan(38.4)
      expect(p.lng).toBeGreaterThan(-123.1)
      expect(p.lng).toBeLessThan(-122.4)
      expect(p.radiusMiles).toBeGreaterThan(0)
    }
  })

  it('each place round-trips through a share token', () => {
    for (const p of MARIN_PLACES) {
      const back = decodeShareToken(encodeShareToken({ lat: p.lat, lng: p.lng, label: p.label, radiusMiles: p.radiusMiles }))
      expect(back?.label).toBe(p.label)
    }
  })

  it('findMarinPlace resolves by slug, case-insensitively', () => {
    expect(findMarinPlace('point-reyes-station')?.label).toBe('Point Reyes Station')
    expect(findMarinPlace('MARSHALL')?.label).toBe('Marshall')
    expect(findMarinPlace('nope')).toBeUndefined()
  })
})

describe('Marin ZIP resolution', () => {
  it('maps every listed ZIP to a real place slug', () => {
    for (const [zip, slug] of Object.entries(MARIN_ZIP_TO_SLUG)) {
      expect(/^\d{5}$/.test(zip)).toBe(true)
      expect(findMarinPlace(slug), `ZIP ${zip} -> unknown slug ${slug}`).toBeDefined()
    }
  })

  it('findMarinPlaceByZip resolves known Marin ZIPs', () => {
    expect(findMarinPlaceByZip('94940')?.label).toBe('Marshall')
    expect(findMarinPlaceByZip('94956')?.label).toBe('Point Reyes Station')
    expect(findMarinPlaceByZip('94901')?.label).toBe('San Rafael')
    expect(findMarinPlaceByZip('99999')).toBeUndefined()
  })

  it('resolveMarinPlace accepts a slug OR a ZIP, not garbage', () => {
    expect(resolveMarinPlace('bolinas')?.label).toBe('Bolinas')
    expect(resolveMarinPlace('94924')?.label).toBe('Bolinas')
    expect(resolveMarinPlace('90210')).toBeUndefined() // valid ZIP shape, not Marin
    expect(resolveMarinPlace('whatever')).toBeUndefined()
  })
})
