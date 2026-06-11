import { describe, expect, it } from 'vitest'

import { inferStoryTags } from './story-taxonomy'
import type { TaxonomyItem } from './personalization-types'

const taxonomy: TaxonomyItem[] = [
  { id: 'topic-politics', kind: 'topic', slug: 'politics-government', label: 'Politics & Government', active: true },
  { id: 'topic-world', kind: 'topic', slug: 'world-affairs', label: 'World Affairs', active: true },
  { id: 'topic-health', kind: 'topic', slug: 'health', label: 'Health', active: true },
  { id: 'region-europe', kind: 'region', slug: 'europe', label: 'Europe', active: true },
  { id: 'region-middle-east', kind: 'region', slug: 'middle-east', label: 'Middle East', active: true },
  { id: 'section-blindspot', kind: 'section', slug: 'global-blindspot', label: 'Global Blindspot', active: true },
  { id: 'section-lens', kind: 'section', slug: 'global-lens', label: 'Global Lens', active: true },
  { id: 'section-limited', kind: 'section', slug: 'limited-coverage', label: 'Limited Coverage', active: true },
]

describe('story taxonomy inference', () => {
  it('tags a limited-coverage regional story by topic, region, and section', () => {
    const tags = inferStoryTags({
      id: 'story-1',
      title: 'Iran missile talks draw new government warning',
      description: 'France 24 reports that officials in the Middle East are preparing for new diplomatic pressure.',
      category: 'reported',
      region: 'Middle East',
      msm_gap: true,
      source_type: 'Public Broadcaster',
      journalist_username: 'france24english',
      source: 'YouTube/France 24 English',
    }, taxonomy)

    expect(tags.map(tag => tag.taxonomyId)).toEqual(expect.arrayContaining([
      'topic-world',
      'region-middle-east',
      'section-blindspot',
      'section-limited',
    ]))
  })

  it('uses health keywords for domestic health stories', () => {
    const tags = inferStoryTags({
      id: 'story-2',
      title: 'Hospital patients face new medicine shortage',
      description: 'Doctors say patient care is being affected by the drug shortage.',
      category: 'reported',
      region: null,
      msm_gap: false,
      source_type: 'Nonprofit Newsroom',
      journalist_username: null,
      source: 'ProPublica',
    }, taxonomy)

    expect(tags.map(tag => tag.taxonomyId)).toContain('topic-health')
  })

  it('does not tag Global Lens for every non-gap regional story', () => {
    const tags = inferStoryTags({
      id: 'story-3',
      title: 'France announces new local rail funding',
      description: 'Regional officials described the rail funding as part of a domestic infrastructure plan.',
      category: 'reported',
      region: 'Europe',
      msm_gap: false,
      source_type: 'Public Broadcaster',
      journalist_username: 'france24english',
      source: 'YouTube/France 24 English',
    }, taxonomy)

    expect(tags.map(tag => tag.taxonomyId)).not.toContain('section-lens')
  })

  it('does not infer Europe from source names alone', () => {
    const tags = inferStoryTags({
      id: 'story-4',
      title: 'Hospital patients face new medicine shortage',
      description: 'Doctors say patient care is being affected by the drug shortage.',
      category: 'reported',
      region: null,
      msm_gap: false,
      source_type: 'Public Broadcaster',
      journalist_username: 'france24english',
      source: 'YouTube/France 24 English',
    }, taxonomy)

    expect(tags.map(tag => tag.taxonomyId)).not.toContain('region-europe')
  })
})
