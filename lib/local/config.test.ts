import { describe, expect, it } from 'vitest'
import { LOCAL_SECTION_KEYS, LOCAL_SECTION_SOURCE, sectionSource } from './config'

describe('local section source config (D1 strangler)', () => {
  it('every section is live until its store read is wired', () => {
    for (const key of LOCAL_SECTION_KEYS) {
      expect(sectionSource(key), key).toBe('live')
    }
  })

  it('has a source flag for exactly the known sections', () => {
    expect(Object.keys(LOCAL_SECTION_SOURCE).sort()).toEqual([...LOCAL_SECTION_KEYS].sort())
  })
})
