import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseLocalNewsRss, articleToLocalEvent } from './local-news'

const fixture = fs.readFileSync(path.join('fixtures', 'sources', 'point-reyes-light', 'sample.xml'), 'utf8')

describe('parseLocalNewsRss', () => {
  it('parses the Point Reyes Light fixture into articles', () => {
    const arts = parseLocalNewsRss(fixture, 'Point Reyes Light')
    expect(arts.length).toBeGreaterThan(0)
    expect(arts.every(a => a.outlet === 'Point Reyes Light')).toBe(true)
    expect(arts.every(a => a.title && a.url && a.publishedAt)).toBe(true)
    expect(arts[0].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO
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
