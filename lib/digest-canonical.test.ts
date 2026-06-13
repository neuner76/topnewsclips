import { describe, expect, it } from 'vitest'
import {
  buildDigestEdition,
  canonicalItemIds,
  deriveMainstreamPulseSynthesis,
  formatDigestMetadata,
  validateDigestEdition,
} from './digest-canonical'
import type { Digest } from './digest'
import type { Story } from './types'

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: overrides.slug ?? 'story-1',
    title: 'Federal labor investigation expands',
    slug: 'story-1',
    description: 'Workers alleged safety failures.',
    embed_url: 'https://example.com/embed',
    platform: 'youtube',
    view_count: 0,
    share_count: 0,
    msm_gap: false,
    msm_notes: null,
    msm_outlet_coverage: { covered: ['AP', 'Reuters', 'NPR', 'NYT', 'WSJ'], notCovered: Array.from({ length: 10 }, (_, i) => `Outlet ${i}`) },
    published: true,
    display_order: 50,
    category: 'reported',
    subcategory: null,
    thumbnail_url: null,
    journalist_username: 'propublica',
    source: 'YouTube/ProPublica',
    region: null,
    source_tier: 1,
    source_type: 'Nonprofit Investigative',
    pinned: false,
    duration: null,
    created_at: '2026-06-13T12:00:00.000Z',
    updated_at: '2026-06-13T12:00:00.000Z',
    verified_interpretation: null,
    qc_status: 'pass',
    qc_failed_checks: null,
    qc_routing_note: null,
    ...overrides,
  }
}

const digest: Digest = {
  id: 'digest-1',
  date: '2026-06-13',
  generated_at: '2026-06-13T12:00:00.000Z',
  content: {
    needToKnow: [{
      sectionTitle: 'Labor probe expands',
      slug: 'story-1',
      paragraphs: [
        'Federal investigators expanded a labor probe after workers alleged safety failures at multiple sites.',
        'The case could affect workplace enforcement, union negotiations, and safety standards for US workers.',
      ],
      howWorldSeesIt: [{ region: 'Europe', slug: 'lens-1', title: 'Europe', summary: 'European outlets center worker protections and regulatory pressure.' }],
    }],
    inTheKnow: {
      'Politics & World Affairs': [
        { text: 'Congress scheduled hearings on labor enforcement.', slug: 'politics-1' },
        { text: 'A governor announced a related review.', slug: 'politics-2' },
        { text: 'The White House said agencies are coordinating.', slug: 'politics-3' },
        { text: 'State regulators opened parallel inspections.', slug: 'politics-4' },
        { text: 'Unions called for stronger penalties.', slug: 'politics-5' },
      ],
      'Science & Technology': [{ text: 'Researchers released a workplace exposure study.', slug: 'science-1' }],
      'Business & Markets': [{ text: 'Markets watched the labor dispute for supply-chain risk.', slug: 'business-1' }],
      'Sports, Entertainment, & Culture': [{ text: 'A documentary revisited labor organizing in film.', slug: 'culture-1' }],
      'Comedy & Satire': [{ text: 'A late-night show covered the strike.', slug: 'culture-2' }],
    },
    etcetera: [{ text: 'A strong wire-service story should be promoted above this bucket.', slug: 'awk-1' }],
    mainstreamPulse: [
      { source: 'AP', descriptor: 'wire', headline: 'Labor probe expands across states', slug: 'story-1' },
      { source: 'Reuters', descriptor: 'wire', headline: 'Markets track labor dispute', slug: 'business-1' },
      { source: 'NPR', descriptor: 'public radio', headline: 'Workers describe safety concerns', slug: 'politics-1' },
      { source: 'WSJ', descriptor: 'business', headline: 'Companies face enforcement pressure', slug: 'politics-2' },
    ],
    globalBlindspots: [{ region: 'Asia', slug: 'blindspot-1', title: 'Regional unions coordinate', summary: 'Regional unions announced coordinated safety demands after a government report documented worker injuries.' }],
    globalLens: [{ region: 'Europe', slug: 'lens-1', title: 'European outlets focus on labor standards', summary: 'European outlets center worker protections rather than the partisan fight in Washington.' }],
  },
}

function storyMap(): Map<string, Story> {
  const slugs = [
    'story-1',
    'lens-1',
    'politics-1',
    'politics-2',
    'politics-3',
    'politics-4',
    'politics-5',
    'science-1',
    'business-1',
    'culture-1',
    'culture-2',
    'blindspot-1',
    'awk-1',
  ]
  return new Map(slugs.map(slug => [slug, story({ id: slug, slug })]))
}

describe('canonical digest', () => {
  it('renames and caps email-first sections while preserving canonical item ids', () => {
    const edition = buildDigestEdition(digest, storyMap(), 'https://www.topnewsclips.com')
    const politics = edition.sections.find(section => section.name === 'Politics & World Affairs')
    const science = edition.sections.find(section => section.name === 'Science, Health & Environment')
    const culture = edition.sections.find(section => section.name === 'Culture, Media & Society')

    expect(politics?.items).toHaveLength(4)
    expect(politics?.omittedCount).toBe(1)
    expect(science?.items[0].id).toBe('science-1')
    expect(culture?.items.map(item => item.id)).toEqual(['culture-1', 'culture-2'])
    expect(canonicalItemIds(edition)).toContain('blindspot-1')
  })

  it('formats complete compact metadata', () => {
    const edition = buildDigestEdition(digest, storyMap(), 'https://www.topnewsclips.com')
    expect(formatDigestMetadata(edition.needToKnow[0].metadata, { includeTier: true })).toContain('Nonprofit Investigative (Tier 1)')
    expect(formatDigestMetadata(edition.needToKnow[0].metadata)).toContain('5 of 15 outlets')
  })

  it('warns on weak placement and vague World View labels', () => {
    const edition = buildDigestEdition(digest, storyMap(), 'https://www.topnewsclips.com')
    const validation = validateDigestEdition(edition)
    expect(validation.warnings).toContain('High-strength story belongs above Also Worth Knowing: awk-1')
    expect(validation.warnings).toContain('World View label is vague: Europe')
  })

  it('derives a Mainstream Pulse synthesis sentence', () => {
    const synthesis = deriveMainstreamPulseSynthesis([
      { source: 'NPR', descriptor: 'public media', headline: '4 things to know about the new sunscreen ingredient the FDA approved' },
      { source: 'NYT', descriptor: 'center-left', headline: 'In Rare Move, D.S.A Rebukes Mamdani Over Police Plans' },
      { source: 'AP', descriptor: 'wire', headline: 'Trump to discuss Strait of Hormuz demining efforts at G7 as confidence grows for Iran war deal' },
      { source: 'Reuters', descriptor: 'global wire', headline: 'USTR Greer to travel to India for trade talks, deal possible, senior US official says' },
      { source: 'WSJ', descriptor: 'business', headline: "SpaceX IPO's potential economic impact on Texas border town" },
    ])
    expect(synthesis).toContain('trade')
    expect(synthesis).not.toContain('things')
  })

  it('prefixes Global Lens summaries without duplicating the verb', () => {
    const edition = buildDigestEdition({
      ...digest,
      content: {
        ...digest.content,
        globalLens: [{ region: 'Europe', slug: 'lens-1', title: 'European outlets focus on labor standards', summary: 'Centers worker protections rather than Washington politics.' }],
      },
    }, storyMap(), 'https://www.topnewsclips.com')
    expect(edition.globalLens[0].summary).toBe('ProPublica centers worker protections rather than Washington politics.')
  })
})
