import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseLocalNewsRss, parseGoogleNewsRss, articleToLocalEvent, mentionsMarinLocal, isLocalToMarin, cleanRssSummary } from './local-news'

const fixture = fs.readFileSync(path.join('fixtures', 'sources', 'point-reyes-light', 'sample.xml'), 'utf8')
const gnews = fs.readFileSync(path.join('fixtures', 'sources', 'marin-ij-googlenews', 'sample.xml'), 'utf8')
const pacificSun = fs.readFileSync(path.join('fixtures', 'sources', 'pacific-sun', 'sample.xml'), 'utf8')

describe('parseLocalNewsRss', () => {
  it('parses the Point Reyes Light fixture into articles', () => {
    const arts = parseLocalNewsRss(fixture, 'Point Reyes Light')
    expect(arts.length).toBeGreaterThan(0)
    expect(arts.every(a => a.outlet === 'Point Reyes Light')).toBe(true)
    expect(arts.every(a => a.title && a.url && a.publishedAt)).toBe(true)
    expect(arts[0].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO
  })

  it('parses the Pacific Sun (WordPress) fixture into Marin-local articles', () => {
    const arts = parseLocalNewsRss(pacificSun, 'Pacific Sun')
    expect(arts.length).toBeGreaterThan(0)
    expect(arts.every(a => a.outlet === 'Pacific Sun' && a.title && a.url)).toBe(true)
  })
})

describe('parseGoogleNewsRss', () => {
  it('parses Marin IJ items and strips the " - Source" title suffix', () => {
    const arts = parseGoogleNewsRss(gnews, 'Marin IJ')
    expect(arts.length).toBeGreaterThan(0)
    expect(arts.every(a => a.outlet === 'Marin IJ' && a.title && a.publishedAt)).toBe(true)
    // Google News appends " - Marin Independent Journal"; it must be stripped.
    expect(arts.every(a => !/ - Marin Independent Journal\s*$/.test(a.title))).toBe(true)
  })
})

describe('articleToLocalEvent', () => {
  it('maps an article to a local_news LocalEvent with a source link', () => {
    const e = articleToLocalEvent({ outlet: 'Point Reyes Light', title: 'Groundwater probe', description: 'A report.', url: 'https://x/story', publishedAt: '2026-09-09T00:00:00Z' })
    expect(e.eventType).toBe('local_news')
    expect(e.title).toBe('Groundwater probe')
    expect(e.sources[0].type).toBe('local_news')
    expect(e.sources[0].label).toBe('Point Reyes Light')
    expect(e.sources[0].url).toBe('https://x/story')
  })
})

describe('cleanRssSummary', () => {
  it('strips the WordPress "appeared first on" boilerplate', () => {
    const raw = 'Salvage crews have dismantled the ship, leaving fishermen to ask why. The post Squid boat dismantled at North Beach appeared first on Point Reyes Light .'
    expect(cleanRssSummary(raw)).toBe('Salvage crews have dismantled the ship, leaving fishermen to ask why.')
  })

  it('turns excerpt cut-off markers into a single ellipsis', () => {
    expect(cleanRssSummary('He said upon […] and left.')).toBe('He said upon … and left.')
    expect(cleanRssSummary('roughly 40 tons of squid [...]')).toBe('roughly 40 tons of squid …')
  })
})

describe('Marin-local filtering', () => {
  it('detects Marin/Novato place names', () => {
    expect(mentionsMarinLocal('Novato City Council approves budget')).toBe(true)
    expect(mentionsMarinLocal('Flooding closes roads in West Marin')).toBe(true)
    expect(mentionsMarinLocal('Santa Clara County foster care investigation')).toBe(false)
  })

  it('passes local-outlet stories always, regional outlets only when they name a Marin place', () => {
    const local = { outlet: 'Point Reyes Light', title: 'New dock opens', publishedAt: '2026-09-09T00:00:00Z' }
    const kqedLocal = { outlet: 'KQED', title: 'San Rafael housing plan advances', publishedAt: '2026-09-09T00:00:00Z' }
    const kqedRegional = { outlet: 'KQED', title: 'Bay Area security workers strike', publishedAt: '2026-09-09T00:00:00Z' }
    expect(isLocalToMarin(local)).toBe(true) // inherently local outlet
    expect(isLocalToMarin(kqedLocal)).toBe(true) // names San Rafael
    expect(isLocalToMarin(kqedRegional)).toBe(false) // regional, no Marin place
  })
})
