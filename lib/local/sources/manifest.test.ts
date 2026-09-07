import { describe, expect, it } from 'vitest'
import manifestJson from './manifest.json'
import type { LocalSourceManifestEntry } from '../types'

const manifest = manifestJson as LocalSourceManifestEntry[]

const STATUSES = new Set(['ready', 'needs_key', 'blocked', 'stub'])
const CATEGORIES = new Set(['government', 'planning', 'emergency', 'incident', 'environment', 'transportation', 'camera', 'journalism'])
const PHASES = new Set(['A', 'B', 'C'])

// Task 0 DoD: the manifest is committed with a status for EVERY source in the spec.
describe('local source manifest', () => {
  it('has entries', () => {
    expect(manifest.length).toBeGreaterThan(0)
  })

  it('gives every source a valid status, category, build phase, and unique id', () => {
    const ids = new Set<string>()
    for (const s of manifest) {
      expect(s.id, `id on ${JSON.stringify(s.name)}`).toBeTruthy()
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false)
      ids.add(s.id)
      expect(STATUSES.has(s.status), `${s.id} status ${s.status}`).toBe(true)
      expect(CATEGORIES.has(s.category), `${s.id} category ${s.category}`).toBe(true)
      expect(PHASES.has(s.buildPhase), `${s.id} phase ${s.buildPhase}`).toBe(true)
      expect(typeof s.requiresKey).toBe('boolean')
      expect(s.entryUrl).toMatch(/^https?:\/\//)
      expect(s.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('marks any key-requiring source with an envVar', () => {
    for (const s of manifest.filter(x => x.requiresKey)) {
      expect(s.envVar, `${s.id} requiresKey but no envVar`).toBeTruthy()
    }
  })

  it('records a reason for every blocked source', () => {
    for (const s of manifest.filter(x => x.status === 'blocked')) {
      expect(s.blockedReason, `${s.id} blocked without a reason`).toBeTruthy()
    }
  })

  it('has the Build-A required environmental feeds marked ready', () => {
    const required = ['nws-alerts', 'nws-forecast', 'usgs-earthquakes', 'noaa-tides']
    for (const id of required) {
      const entry = manifest.find(s => s.id === id)
      expect(entry, `missing ${id}`).toBeDefined()
      expect(entry?.status, `${id} not ready`).toBe('ready')
      expect(entry?.buildPhase).toBe('A')
      expect(entry?.requiresKey).toBe(false)
    }
  })
})
