import { describe, expect, it, afterEach } from 'vitest'
import { sectionSource } from './config'

const orig = process.env.LOCAL_STORE_SECTIONS
afterEach(() => { process.env.LOCAL_STORE_SECTIONS = orig })

describe('sectionSource env override (D1 flip)', () => {
  it('defaults to live', () => {
    delete process.env.LOCAL_STORE_SECTIONS
    expect(sectionSource('roadsAndIncidents')).toBe('live')
  })
  it('flips listed sections to store, ignores unknown keys', () => {
    process.env.LOCAL_STORE_SECTIONS = 'roadsAndIncidents, bogusKey'
    expect(sectionSource('roadsAndIncidents')).toBe('store')
    expect(sectionSource('needToKnow')).toBe('live')
  })
})
