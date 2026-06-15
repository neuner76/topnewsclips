// Durable digest test fixtures (Task 16).
//
// Tests must describe PATTERNS, not whatever is on today's live feed. These
// generic fixtures replace stale story-name assertions (Screwworm, Pentagon UFO
// files, Ariana Grande, …) so a passing suite never depends on the current pull.

import type { Story } from './types'

const covered = (n: number) => ({ covered: Array.from({ length: n }, (_, i) => `o${i}`), notCovered: Array.from({ length: Math.max(0, 14 - n) }, (_, i) => `u${i}`) })

function baseStory(overrides: Partial<Story>): Story {
  return {
    id: overrides.slug ?? 't',
    title: '',
    slug: overrides.slug ?? 't',
    description: '',
    embed_url: '',
    platform: 'youtube',
    view_count: 0,
    share_count: 0,
    msm_gap: false,
    msm_notes: null,
    msm_outlet_coverage: null,
    published: true,
    display_order: 0,
    category: 'reported',
    subcategory: null,
    thumbnail_url: null,
    journalist_username: null,
    source: null,
    region: null,
    source_tier: 5,
    source_type: 'Independent Journalist',
    pinned: false,
    duration: null,
    created_at: '2026-06-14',
    updated_at: '2026-06-14',
    verified_interpretation: null,
    qc_status: 'pass',
    qc_failed_checks: null,
    qc_routing_note: null,
    ...overrides,
  }
}

export const fixtures = {
  // Commentary/analysis, T7, 2-of-14 — the motivating weak-format lead. Blocked
  // from the lead slot by content type; also override-required on tier/coverage.
  commentaryAnalysisLowCoverageStory: baseStory({
    slug: 'commentary-low-coverage',
    title: 'How AI-generated war propaganda is reshaping the conflict narrative',
    description: 'An analysis of how synthetic media is being deployed in the ongoing war.',
    category: 'analysis',
    source_tier: 7,
    source_type: 'Independent Commentary',
    msm_outlet_coverage: covered(2),
    msm_gap: true,
  }),

  // Restricted source (VICE) — handled via the table-backed policy in real runs;
  // the policy is hard-coded only in tests via a SourcePolicy map.
  restrictedViceStory: baseStory({
    slug: 'vice-story',
    title: 'Inside the new front of the information war',
    description: 'A report on disinformation networks.',
    category: 'analysis',
    source_tier: 7,
    source_type: 'Independent Commentary',
    journalist_username: 'vicenews',
    source: 'YouTube/VICE News',
    msm_outlet_coverage: covered(3),
  }),

  // Reported, corroborated, consequential — a clean eligible lead.
  reportedCorroboratedLead: baseStory({
    slug: 'reported-lead',
    title: 'Supreme Court ruling sets new federal regulatory deadline for agencies',
    description: 'The decision forces agencies to act within 90 days.',
    category: 'reported',
    source_tier: 3,
    msm_outlet_coverage: covered(8),
  }),

  // Practical public-health story — strong, should outrank curiosity items.
  practicalPublicHealthStory: baseStory({
    slug: 'public-health',
    title: 'Disease outbreak prompts recall and public-health warning across three states',
    description: 'Officials urge residents to take precautions.',
    category: 'reported',
    source_tier: 2,
    msm_outlet_coverage: covered(7),
  }),

  // Curiosity/disclosure — interesting but consequence-thin and weakly sourced.
  curiosityDisclosureStory: baseStory({
    slug: 'curiosity',
    title: 'Newly released archive documents detail a decades-old administrative quirk',
    description: 'A look at an obscure filing.',
    category: 'reported',
    source_tier: 7,
    msm_outlet_coverage: covered(1),
  }),

  // Celebrity music-use dispute — routes to Culture, Media & Society absent a
  // formal legal/policy hook.
  celebrityMusicUseDispute: baseStory({
    slug: 'celebrity-music',
    title: 'Pop star disputes use of her song at a campaign event',
    description: 'A public back-and-forth over licensing.',
    category: 'reported',
    source_tier: 5,
    msm_outlet_coverage: covered(4),
  }),

  // State-affiliated migration claim — T8 single-source; needs caution/exclusion.
  stateAffiliatedMigrationClaim: baseStory({
    slug: 'state-migration',
    title: 'State outlet reports surge of migrants massing at the border amid escalating tensions',
    description: 'The report could not be independently verified.',
    category: 'reported',
    source_tier: 8,
    source_type: 'State Media',
    msm_outlet_coverage: covered(0),
    msm_gap: true,
  }),

  // Low-coverage international story — Global Blindspot candidate.
  lowCoverageInternationalStory: baseStory({
    slug: 'intl-blindspot',
    title: 'Drought displaces thousands in a region receiving little U.S. coverage',
    description: 'Local outlets report worsening conditions.',
    category: 'reported',
    source_tier: 4,
    region: 'Africa',
    msm_outlet_coverage: covered(0),
    msm_gap: true,
  }),

  // Active public-safety story — developing_safety; valuable while new/uncovered.
  activePublicSafetyStory: baseStory({
    slug: 'public-safety',
    title: 'Tornado forces evacuation across county as severe weather intensifies',
    description: 'Emergency services issue shelter orders.',
    category: 'reported',
    source_tier: 3,
    msm_outlet_coverage: covered(3),
  }),

  // Mainstream Pulse item that wrongly links internally — fails link validation.
  mainstreamPulseInternalLinkItem: {
    headline: 'Major outlet leads with infrastructure bill vote',
    source: 'AP',
    descriptor: 'Wire',
    url: '/story/youtube-abc123',
    linkMode: 'external_source' as const,
  },

  // Mainstream Pulse item with a correct external link — passes validation.
  mainstreamPulseExternalLinkItem: {
    headline: 'Major outlet leads with infrastructure bill vote',
    source: 'Reuters',
    descriptor: 'Wire',
    url: 'https://www.reuters.com/world/us/infrastructure-bill-vote',
    linkMode: 'external_source' as const,
  },
}
